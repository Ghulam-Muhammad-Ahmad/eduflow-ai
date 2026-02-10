import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/integrations/supabase/server";

const MAX_PDF_BASE64_MB = 20;
const MAX_PDF_BYTES = MAX_PDF_BASE64_MB * 1024 * 1024;

type TargetLevel = "below_grade" | "at_grade" | "above_grade";

const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API key not configured");
  return new OpenAI({ apiKey });
};

const levelDescriptions: Record<TargetLevel, string> = {
  below_grade: "simplified for students working below grade level",
  at_grade: "appropriate for students at grade level",
  above_grade: "challenging for students working above grade level",
};

/** Smart Tutor with pasted text: Chat Completions */
async function smartTutorWithText(
  openai: OpenAI,
  pastedText: string,
  targetLevel: TargetLevel,
  subject: string,
  gradeLevel: string
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const system =
    "You are an expert in differentiated instruction. Modify content appropriately for different learning levels while maintaining educational value. Output only the adapted content, no preamble.";
  const prompt = `Modify this ${subject} content for ${gradeLevel} grade students, making it ${levelDescriptions[targetLevel]}:\n\n${pastedText}\n\nMaintain the core concepts but adjust complexity, vocabulary, and depth appropriately.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    temperature: 0.5,
  });

  const content = completion.choices[0]?.message?.content ?? "";
  const usage = completion.usage;
  return {
    content,
    inputTokens: usage?.prompt_tokens ?? 0,
    outputTokens: usage?.completion_tokens ?? 0,
  };
}

/** Smart Tutor with PDF: Responses API with file attachment (no text parsing) */
async function smartTutorWithPdf(
  apiKey: string,
  pdfBase64: string,
  targetLevel: TargetLevel,
  subject: string,
  gradeLevel: string
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const fileData = pdfBase64.startsWith("data:")
    ? pdfBase64
    : `data:application/pdf;base64,${pdfBase64}`;

  const userPrompt = `This is ${subject} content for ${gradeLevel}. Adapt it so it is ${levelDescriptions[targetLevel]}. Maintain core concepts but adjust complexity, vocabulary, and depth. Output only the adapted content.`;

  const body = {
    model: "gpt-4o",
    input: [
      {
        role: "user",
        content: [
          { type: "input_file", filename: "document.pdf", file_data: fileData },
          { type: "input_text", text: userPrompt },
        ],
      },
    ],
    instructions:
      "You are an expert in differentiated instruction. Modify the attached document content for the requested learning level. Output only the adapted content, no preamble or explanation.",
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(err || "OpenAI Responses API error");
  }

  const data = (await response.json()) as {
    output?: Array<{ content?: Array<{ type: string; text?: string }> }>;
    usage?: { input_tokens: number; output_tokens: number };
  };

  const outputText =
    data.output?.[0]?.content?.find((c) => c.type === "output_text")?.text ?? "";
  const usage = data.usage;
  return {
    content: outputText.trim(),
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
  };
}

export const config = {
  api: { bodyParser: { sizeLimit: "25mb" } },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { user, error: authError } = await getAuthUser(req, res);
  if (authError || !user) {
    return res.status(401).json({ error: authError?.message ?? "Unauthorized" });
  }

  const {
    pastedText,
    pdfBase64,
    targetLevel,
    subject,
    gradeLevel,
  } = req.body || {};

  if (!pastedText && !pdfBase64) {
    return res.status(400).json({
      error: "Provide either pastedText or pdfBase64 (base64-encoded PDF)",
    });
  }

  const level = targetLevel as TargetLevel;
  if (!level || !["below_grade", "at_grade", "above_grade"].includes(level)) {
    return res.status(400).json({ error: "Invalid targetLevel" });
  }
  if (!subject || typeof subject !== "string" || !subject.trim()) {
    return res.status(400).json({ error: "subject is required" });
  }
  if (!gradeLevel || typeof gradeLevel !== "string" || !gradeLevel.trim()) {
    return res.status(400).json({ error: "gradeLevel is required" });
  }

  if (pdfBase64 && typeof pdfBase64 === "string") {
    const estimatedBytes = (pdfBase64.length * 3) / 4;
    if (estimatedBytes > MAX_PDF_BYTES) {
      return res.status(400).json({
        error: `PDF too large. Max ${MAX_PDF_BASE64_MB} MB.`,
      });
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: "Server not configured" });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const usageCheck = await supabase.rpc("can_make_ai_request", {
    _user_id: user.id,
  });
  const usageData = usageCheck.data as
    | { can_request?: boolean; reason?: string }
    | null;
  if (!usageData?.can_request) {
    return res.status(403).json({
      error: usageData?.reason || "AI usage limit reached",
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "OpenAI API key not configured" });
  }

  try {
    let result: { content: string; inputTokens: number; outputTokens: number };
    let model: string;

    if (pdfBase64 && typeof pdfBase64 === "string") {
      result = await smartTutorWithPdf(
        apiKey,
        pdfBase64,
        level,
        subject.trim(),
        gradeLevel.trim()
      );
      model = "gpt-4o";
    } else {
      const pasted = String(pastedText ?? "").trim();
      if (!pasted) {
        return res.status(400).json({ error: "pastedText is empty" });
      }
      const openai = getOpenAIClient();
      result = await smartTutorWithText(
        openai,
        pasted,
        level,
        subject.trim(),
        gradeLevel.trim()
      );
      model = "gpt-4o-mini";
    }

    const totalTokens = result.inputTokens + result.outputTokens;
    const cost =
      model === "gpt-4o"
        ? (result.inputTokens / 1000) * 0.0025 + (result.outputTokens / 1000) * 0.01
        : (result.inputTokens / 1000) * 0.00015 + (result.outputTokens / 1000) * 0.0006;

    await supabase.rpc("record_ai_interaction", {
      _user_id: user.id,
      _interaction_type: "differentiation",
      _provider: "openai",
      _model: model,
      _tokens_used: totalTokens,
      _cost: cost,
      _success: true,
      _error_message: null,
    });

    return res.status(200).json({
      success: true,
      content: result.content,
    });
  } catch (error: unknown) {
    console.error("Smart tutor error:", error);
    await supabase.rpc("record_ai_interaction", {
      _user_id: user.id,
      _interaction_type: "differentiation",
      _provider: "openai",
      _model: "gpt-4o",
      _tokens_used: 0,
      _cost: 0,
      _success: false,
      _error_message: error instanceof Error ? error.message : "Smart tutor failed",
    });
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to adapt content",
    });
  }
}
