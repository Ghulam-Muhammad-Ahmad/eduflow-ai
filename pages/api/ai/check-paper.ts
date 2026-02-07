import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const MAX_PDF_BASE64_MB = 20;
const MAX_PDF_BYTES = MAX_PDF_BASE64_MB * 1024 * 1024;

const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API key not configured");
  return new OpenAI({ apiKey });
};

/** Check paper via paste: use Chat Completions, return structured JSON + usage */
async function checkPastedText(
  openai: OpenAI,
  pastedText: string,
  instructions: string,
  rubricCategories?: { name: string; max_points: number; description?: string }[]
): Promise<{
  grade: number;
  feedback: string;
  mistakes: string[];
  gradeBreakdown?: { category: string; points: number; maxPoints: number; feedback: string }[];
  inputTokens: number;
  outputTokens: number;
}> {
  const rubricPrompt = rubricCategories && rubricCategories.length > 0 
    ? `Grade using this rubric:\n${rubricCategories.map(cat => 
        `- ${cat.name}: ${cat.max_points} points${cat.description ? ` (${cat.description})` : ''}`
      ).join('\n')}\n\n`
    : '';

  const system = `You are an expert teacher checking a student paper. ${rubricPrompt}${instructions ? `Follow these instructions: ${instructions}. ` : ""}
Respond with ONLY a single JSON object (no markdown, no code block) with exactly:
- "grade" (number, 0-100)
- "feedback" (string, your full feedback)
- "mistakes" (array of strings, list of specific issues/mistakes found)
- "gradeBreakdown" (array of objects, each with: "category" (string), "points" (number), "maxPoints" (number), "feedback" (string))`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: system },
      { role: "user", content: `Paper to check:\n\n${pastedText}` },
    ],
    temperature: 0.5,
  });

  const content = completion.choices[0]?.message?.content || "";
  const raw = content.trim().replace(/^```json?\s*|\s*```$/g, "");
  const parsed = JSON.parse(raw) as {
    grade?: number;
    feedback?: string;
    mistakes?: string[];
    gradeBreakdown?: { category: string; points: number; maxPoints: number; feedback: string }[];
  };
  const usage = completion.usage;
  return {
    grade: typeof parsed.grade === "number" ? parsed.grade : 0,
    feedback: typeof parsed.feedback === "string" ? parsed.feedback : "",
    mistakes: Array.isArray(parsed.mistakes)
      ? parsed.mistakes.map((m) => String(m))
      : [],
    gradeBreakdown: Array.isArray(parsed.gradeBreakdown) ? parsed.gradeBreakdown : undefined,
    inputTokens: usage?.prompt_tokens ?? 0,
    outputTokens: usage?.completion_tokens ?? 0,
  };
}

/** Check paper via PDF: use Responses API with base64 file input (full document) */
async function checkPdfWithResponses(
  apiKey: string,
  pdfBase64: string,
  instructions: string,
  rubricCategories?: { name: string; max_points: number; description?: string }[]
): Promise<{
  grade: number;
  feedback: string;
  mistakes: string[];
  gradeBreakdown?: { category: string; points: number; maxPoints: number; feedback: string }[];
  inputTokens: number;
  outputTokens: number;
}> {
  const rubricPrompt = rubricCategories && rubricCategories.length > 0 
    ? `Grade using this rubric:\n${rubricCategories.map(cat => 
        `- ${cat.name}: ${cat.max_points} points${cat.description ? ` (${cat.description})` : ''}`
      ).join('\n')}\n\n`
    : '';

  const system = `You are an expert teacher. You will receive a full document (PDF). ${rubricPrompt}${instructions ? `Follow these instructions: ${instructions}. ` : ""}
Analyze the full document and respond with ONLY a single JSON object (no markdown, no code block) with exactly:
- "grade" (number, 0-100)
- "feedback" (string, your full feedback)
- "mistakes" (array of strings, list of specific issues/mistakes found)
- "gradeBreakdown" (array of objects, each with: "category" (string), "points" (number), "maxPoints" (number), "feedback" (string))`;

  const fileData =
    pdfBase64.startsWith("data:") ? pdfBase64 : `data:application/pdf;base64,${pdfBase64}`;

  const body = {
    model: "gpt-4o",
    input: [
      {
        role: "user",
        content: [
          { type: "input_file", filename: "paper.pdf", file_data: fileData },
          {
            type: "input_text",
            text: instructions
              ? `Instructions: ${instructions}\n\nAnalyze this document and provide grade, feedback, list of mistakes, and grade breakdown.`
              : "Analyze this document and provide grade, feedback, list of mistakes, and grade breakdown.",
          },
        ],
      },
    ],
    instructions: system,
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
  const raw = outputText.trim().replace(/^```json?\s*|\s*```$/g, "");
  let parsed: { 
    grade?: number; 
    feedback?: string; 
    mistakes?: string[]; 
    gradeBreakdown?: { category: string; points: number; maxPoints: number; feedback: string }[];
  };
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {
      grade: 0,
      feedback: outputText || "Could not parse response.",
      mistakes: [],
      gradeBreakdown: undefined,
    };
  }

  const usage = data.usage;
  return {
    grade: typeof parsed.grade === "number" ? parsed.grade : 0,
    feedback: typeof parsed.feedback === "string" ? parsed.feedback : "",
    mistakes: Array.isArray(parsed.mistakes)
      ? parsed.mistakes.map((m) => String(m))
      : [],
    gradeBreakdown: Array.isArray(parsed.gradeBreakdown) ? parsed.gradeBreakdown : undefined,
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

  const { userId, instructions, pastedText, pdfBase64, rubricCategories } = req.body || {};

  if (!userId) {
    return res.status(400).json({ error: "userId required" });
  }

  if (!pastedText && !pdfBase64) {
    return res.status(400).json({
      error: "Provide either pastedText or pdfBase64 (base64-encoded PDF)",
    });
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
    _user_id: userId,
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

  const instructionsStr =
    typeof instructions === "string" ? instructions.trim() : "";

  try {
    if (pdfBase64 && typeof pdfBase64 === "string") {
      const result = await checkPdfWithResponses(
        apiKey,
        pdfBase64,
        instructionsStr,
        rubricCategories
      );
      const totalTokens = result.inputTokens + result.outputTokens;
      const cost =
        (result.inputTokens / 1000) * 0.0025 +
        (result.outputTokens / 1000) * 0.01;

      await supabase.rpc("record_ai_interaction", {
        _user_id: userId,
        _interaction_type: "checker",
        _provider: "openai",
        _model: "gpt-4o",
        _tokens_used: totalTokens,
        _cost: cost,
        _success: true,
        _error_message: null,
      });

      return res.status(200).json({
        success: true,
        grade: result.grade,
        feedback: result.feedback,
        mistakes: result.mistakes,
        gradeBreakdown: result.gradeBreakdown,
        model: "gpt-4o",
      });
    }

    const pasted = String(pastedText || "").trim();
    if (!pasted) {
      return res.status(400).json({ error: "pastedText is empty" });
    }

    const openai = getOpenAIClient();
    const result = await checkPastedText(openai, pasted, instructionsStr, rubricCategories);

    const totalTokens = result.inputTokens + result.outputTokens;
    const cost =
      (result.inputTokens / 1000) * 0.00015 +
      (result.outputTokens / 1000) * 0.0006;

    await supabase.rpc("record_ai_interaction", {
      _user_id: userId,
      _interaction_type: "checker",
      _provider: "openai",
      _model: "gpt-4o-mini",
      _tokens_used: totalTokens,
      _cost: cost,
      _success: true,
      _error_message: null,
    });

    return res.status(200).json({
      success: true,
      grade: result.grade,
      feedback: result.feedback,
      mistakes: result.mistakes,
      gradeBreakdown: result.gradeBreakdown,
      model: "gpt-4o-mini",
    });
  } catch (error: any) {
    console.error("Check paper error:", error);
    await supabase.rpc("record_ai_interaction", {
      _user_id: userId,
      _interaction_type: "checker",
      _provider: "openai",
      _model: "gpt-4o",
      _tokens_used: 0,
      _cost: 0,
      _success: false,
      _error_message: error?.message || "Check paper failed",
    });
    return res.status(500).json({
      success: false,
      error: error?.message || "Failed to check paper",
    });
  }
}
