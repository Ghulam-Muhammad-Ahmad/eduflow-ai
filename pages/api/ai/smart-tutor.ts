import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import { getAuthUser } from "@/integrations/supabase/server";
import { stripMarkdownCodeFence } from "@/lib/utils";
import { deductCreditsForRequest } from "@/lib/ai-credits-deduct";

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

/** Smart Tutor with pasted text: Chat Completions. Optional editInstructions for regeneration (e.g. "add more examples", "simplify further"). */
async function smartTutorWithText(
  openai: OpenAI,
  pastedText: string,
  targetLevel: TargetLevel,
  subject: string,
  gradeLevel: string,
  editInstructions?: string
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const system =
    "You are an expert in differentiated instruction. Modify content appropriately for different learning levels while maintaining educational value. Output only the adapted content in markdown format, no preamble.";
  let prompt = `Modify this ${subject} content for ${gradeLevel} grade students, making it ${levelDescriptions[targetLevel]}:\n\n${pastedText}\n\nMaintain the core concepts but adjust complexity, vocabulary, and depth appropriately.`;
  if (editInstructions && editInstructions.trim()) {
    prompt += `\n\nAdditional instructions from the teacher (apply these to the output): ${editInstructions.trim()}`;
  }

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

/** Smart Tutor with PDF: Responses API with base64 input_file (no PDF-to-text conversion). */
async function smartTutorWithPdf(
  openai: OpenAI,
  pdfBase64: string,
  targetLevel: TargetLevel,
  subject: string,
  gradeLevel: string
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const base64String = pdfBase64.startsWith("data:")
    ? pdfBase64.replace(/^data:application\/pdf;base64,/, "")
    : pdfBase64;
  const fileData = `data:application/pdf;base64,${base64String}`;

  const userPrompt = `This is ${subject} content for ${gradeLevel}. Adapt it so it is ${levelDescriptions[targetLevel]}. Maintain core concepts but adjust complexity, vocabulary, and depth. Output only the adapted content.`;

  const response = await openai.responses.create({
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
      "You are an expert in differentiated instruction. Modify the attached document content for the requested learning level. Output only the adapted content in markdown format, no preamble or explanation.",
  });

  const outputText =
    (response as { output_text?: string }).output_text ??
    (Array.isArray((response as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> }).output)
      ? (response as { output: Array<{ content?: Array<{ type?: string; text?: string }> }> }).output
          .flatMap((o) => o.content ?? [])
          .find((c) => c.type === "output_text")
          ?.text ?? ""
      : "") ?? "";
  const usage = (response as { usage?: { input_tokens?: number; output_tokens?: number } }).usage;
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
    fileName,
    targetLevel,
    subject,
    gradeLevel,
    editInstructions,
  } = req.body || {};

  if (!pastedText && !pdfBase64) {
    return res.status(400).json({
      error: "Provide either pastedText or pdfBase64 (base64-encoded file)",
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

  const maxFileBytes = MAX_PDF_BYTES;
  if (pdfBase64 && typeof pdfBase64 === "string") {
    const estimatedBytes = (pdfBase64.length * 3) / 4;
    if (estimatedBytes > maxFileBytes) {
      return res.status(400).json({
        error: `File too large. Max ${MAX_PDF_BASE64_MB} MB.`,
      });
    }
  }

  /** Returns true if the file should be sent as PDF to OpenAI (PDF only). Otherwise we extract text. */
  const isPdfFile = (name: string | undefined) => {
    if (!name) return true;
    const lower = name.toLowerCase();
    return lower.endsWith(".pdf");
  };

  /** Extract plain text from DOCX/DOC/TXT buffer for use with text-based Smart Tutor. */
  async function extractTextFromBuffer(
    buffer: Buffer,
    name: string | undefined
  ): Promise<string> {
    const lower = name?.toLowerCase() ?? "";
    if (lower.endsWith(".txt") || lower.endsWith(".text")) {
      return buffer.toString("utf-8");
    }
    if (
      lower.endsWith(".docx") ||
      lower.endsWith(".doc") ||
      (typeof name === "string" &&
        (name.includes("wordprocessingml") || name.includes("msword")))
    ) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return result?.value ?? "";
    }
    throw new Error("Unsupported file type for text extraction. Use PDF, DOCX, DOC, or TXT.");
  }

  const creditError = await deductCreditsForRequest(user.id, "differentiation");
  if (creditError) {
    return res.status(creditError.status).json({
      error: creditError.body.error,
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "OpenAI API key not configured" });
  }

  try {
    let result: { content: string; inputTokens: number; outputTokens: number };
    let model: string;
    const openai = getOpenAIClient();

    if (pdfBase64 && typeof pdfBase64 === "string") {
      const name = typeof fileName === "string" ? fileName.trim() || undefined : undefined;
      if (isPdfFile(name)) {
        result = await smartTutorWithPdf(
          openai,
          pdfBase64,
          level,
          subject.trim(),
          gradeLevel.trim()
        );
        model = "gpt-4o";
      } else {
        const raw = Buffer.from(pdfBase64, "base64");
        const extractedText = await extractTextFromBuffer(raw, name);
        const trimmed = extractedText.trim();
        if (!trimmed) {
          return res.status(400).json({
            error: "No text could be extracted from the file. Try a different file or paste content.",
          });
        }
        const editInst = typeof editInstructions === "string" ? editInstructions.trim() || undefined : undefined;
        result = await smartTutorWithText(
          openai,
          trimmed,
          level,
          subject.trim(),
          gradeLevel.trim(),
          editInst
        );
        model = "gpt-4o-mini";
      }
    } else {
      const pasted = String(pastedText ?? "").trim();
      if (!pasted) {
        return res.status(400).json({ error: "pastedText is empty" });
      }
      const editInst = typeof editInstructions === "string" ? editInstructions.trim() || undefined : undefined;
      result = await smartTutorWithText(
        openai,
        pasted,
        level,
        subject.trim(),
        gradeLevel.trim(),
        editInst
      );
      model = "gpt-4o-mini";
    }

    return res.status(200).json({
      success: true,
      content: stripMarkdownCodeFence(result.content),
    });
  } catch (error: unknown) {
    console.error("Smart tutor error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to adapt content",
    });
  }
}
