import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import { getAuthUser } from "@/integrations/supabase/server";
import { deductCreditsForRequest } from "@/lib/ai-credits-deduct";

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

/** Check paper via PDF: Responses API with base64 input_file (no PDF-to-text conversion). */
async function checkPdfWithResponses(
  openai: OpenAI,
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

  const base64String =
    pdfBase64.startsWith("data:") ? pdfBase64.replace(/^data:application\/pdf;base64,/, "") : pdfBase64;
  const fileData = `data:application/pdf;base64,${base64String}`;

  const response = await openai.responses.create({
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
  });

  const outputText =
    (response as { output_text?: string }).output_text ??
    (Array.isArray((response as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> }).output)
      ? (response as { output: Array<{ content?: Array<{ type?: string; text?: string }> }> }).output
          .flatMap((o) => o.content ?? [])
          .find((c) => c.type === "output_text")
          ?.text ?? ""
      : "") ?? "";
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

  const usage = (response as { usage?: { input_tokens?: number; output_tokens?: number } }).usage;
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

  const { user, error: authError } = await getAuthUser(req, res);
  if (authError || !user) {
    return res.status(401).json({ error: authError?.message ?? "Unauthorized" });
  }
  const userId = user.id;

  const { instructions, pastedText, pdfBase64, rubricCategories } = req.body || {};

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

  const creditError = await deductCreditsForRequest(userId, "checker");
  if (creditError) {
    return res.status(creditError.status).json({
      error: creditError.body.error,
    });
  }

  const openai = getOpenAIClient();

  const instructionsStr =
    typeof instructions === "string" ? instructions.trim() : "";

  try {
    if (pdfBase64 && typeof pdfBase64 === "string") {
      const result = await checkPdfWithResponses(
        openai,
        pdfBase64,
        instructionsStr,
        rubricCategories
      );

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

    const result = await checkPastedText(openai, pasted, instructionsStr, rubricCategories);

    return res.status(200).json({
      success: true,
      grade: result.grade,
      feedback: result.feedback,
      mistakes: result.mistakes,
      gradeBreakdown: result.gradeBreakdown,
      model: "gpt-4o-mini",
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Check paper failed";
    console.error("Check paper error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to check paper",
    });
  }
}
