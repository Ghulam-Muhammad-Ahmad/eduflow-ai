import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { deductCreditsForRequest } from "@/lib/ai-credits-deduct";
import {
  chatComplete,
  extractDocumentText,
  hasOpenCodeKey,
  MISSING_KEY_MESSAGE,
  parseJsonResponse,
} from "@/server/ai/opencode";

const MAX_PDF_BASE64_MB = 20;
const MAX_PDF_BYTES = MAX_PDF_BASE64_MB * 1024 * 1024;

type RubricCategory = { name: string; max_points: number; description?: string };

interface CheckResult {
  grade: number;
  feedback: string;
  mistakes: string[];
  gradeBreakdown?: { category: string; points: number; maxPoints: number; feedback: string }[];
  model: string;
  inputTokens: number;
  outputTokens: number;
}

function buildSystemPrompt(instructions: string, rubricCategories?: RubricCategory[]): string {
  const rubricPrompt =
    rubricCategories && rubricCategories.length > 0
      ? `Grade using this rubric:\n${rubricCategories
          .map((cat) => `- ${cat.name}: ${cat.max_points} points${cat.description ? ` (${cat.description})` : ""}`)
          .join("\n")}\n\n`
      : "";

  return `You are an expert teacher checking a student paper. ${rubricPrompt}${instructions ? `Follow these instructions: ${instructions}. ` : ""}
Respond with ONLY a single JSON object (no markdown, no code block) with exactly:
- "grade" (number, 0-100)
- "feedback" (string, your full feedback)
- "mistakes" (array of strings, list of specific issues/mistakes found)
- "gradeBreakdown" (array of objects, each with: "category" (string), "points" (number), "maxPoints" (number), "feedback" (string))`;
}

/** Grade a paper supplied as text. Documents are extracted to text before they get here. */
async function checkPaperText(
  paperText: string,
  instructions: string,
  rubricCategories?: RubricCategory[]
): Promise<CheckResult> {
  const result = await chatComplete({
    prompt: `Paper to check:\n\n${paperText}`,
    system: buildSystemPrompt(instructions, rubricCategories),
    taskType: "checker",
    temperature: 0.5,
    json: true,
  });

  let parsed: {
    grade?: number;
    feedback?: string;
    mistakes?: string[];
    gradeBreakdown?: { category: string; points: number; maxPoints: number; feedback: string }[];
  };
  try {
    parsed = parseJsonResponse(result.content);
  } catch {
    parsed = {
      grade: 0,
      feedback: result.content || "Could not parse response.",
      mistakes: [],
      gradeBreakdown: undefined,
    };
  }

  return {
    grade: typeof parsed.grade === "number" ? parsed.grade : 0,
    feedback: typeof parsed.feedback === "string" ? parsed.feedback : "",
    mistakes: Array.isArray(parsed.mistakes) ? parsed.mistakes.map((m) => String(m)) : [],
    gradeBreakdown: Array.isArray(parsed.gradeBreakdown) ? parsed.gradeBreakdown : undefined,
    model: result.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
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

  const { instructions, pastedText, pdfBase64, fileName, rubricCategories } = req.body || {};

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

  if (!hasOpenCodeKey()) {
    return res.status(500).json({ error: MISSING_KEY_MESSAGE });
  }

  const instructionsStr =
    typeof instructions === "string" ? instructions.trim() : "";

  try {
    let paperText: string;

    if (pdfBase64 && typeof pdfBase64 === "string") {
      const name = typeof fileName === "string" ? fileName.trim() || undefined : undefined;
      paperText = await extractDocumentText(pdfBase64, name);
      if (!paperText) {
        return res.status(400).json({
          error: "No text could be extracted from the paper. Try a different file or paste the content.",
        });
      }
    } else {
      paperText = String(pastedText || "").trim();
      if (!paperText) {
        return res.status(400).json({ error: "pastedText is empty" });
      }
    }

    const result = await checkPaperText(paperText, instructionsStr, rubricCategories);

    return res.status(200).json({
      success: true,
      grade: result.grade,
      feedback: result.feedback,
      mistakes: result.mistakes,
      gradeBreakdown: result.gradeBreakdown,
      model: result.model,
    });
  } catch (error: unknown) {
    console.error("Check paper error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to check paper",
    });
  }
}
