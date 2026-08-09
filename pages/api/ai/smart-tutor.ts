import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { stripMarkdownCodeFence } from "@/lib/utils";
import { deductCreditsForRequest } from "@/lib/ai-credits-deduct";
import {
  chatComplete,
  extractDocumentText,
  hasOpenCodeKey,
  MISSING_KEY_MESSAGE,
} from "@/server/ai/opencode";

const MAX_PDF_BASE64_MB = 20;
const MAX_PDF_BYTES = MAX_PDF_BASE64_MB * 1024 * 1024;

type TargetLevel = "below_grade" | "at_grade" | "above_grade";

const levelDescriptions: Record<TargetLevel, string> = {
  below_grade: "simplified for students working below grade level",
  at_grade: "appropriate for students at grade level",
  above_grade: "challenging for students working above grade level",
};

const SMART_TUTOR_SYSTEM =
  "You are an expert in differentiated instruction. Modify content appropriately for different learning levels while maintaining educational value. Output only the adapted content in markdown format, no preamble.";

/** Adapt content for a learning level. `sourceLabel` names where the content came from (paste vs document). */
async function smartTutorWithText(
  content: string,
  targetLevel: TargetLevel,
  subject: string,
  gradeLevel: string,
  editInstructions?: string,
  sourceLabel?: string
): Promise<{ content: string; model: string; inputTokens: number; outputTokens: number }> {
  const intro = sourceLabel
    ? `Modify this ${subject} content (extracted from ${sourceLabel}) for ${gradeLevel} grade students`
    : `Modify this ${subject} content for ${gradeLevel} grade students`;
  let prompt = `${intro}, making it ${levelDescriptions[targetLevel]}:\n\n${content}\n\nMaintain the core concepts but adjust complexity, vocabulary, and depth appropriately.`;
  if (editInstructions && editInstructions.trim()) {
    prompt += `\n\nAdditional instructions from the teacher (apply these to the output): ${editInstructions.trim()}`;
  }

  const result = await chatComplete({
    prompt,
    system: SMART_TUTOR_SYSTEM,
    taskType: "differentiation",
    temperature: 0.5,
  });
  return result;
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

  const creditError = await deductCreditsForRequest(user.id, "differentiation");
  if (creditError) {
    return res.status(creditError.status).json({
      error: creditError.body.error,
    });
  }

  if (!hasOpenCodeKey()) {
    return res.status(500).json({ error: MISSING_KEY_MESSAGE });
  }

  try {
    const editInst = typeof editInstructions === "string" ? editInstructions.trim() || undefined : undefined;
    let result: { content: string; model: string; inputTokens: number; outputTokens: number };

    if (pdfBase64 && typeof pdfBase64 === "string") {
      // The OpenCode gateway takes text only, so PDF/DOCX/TXT uploads are all
      // extracted here before being adapted.
      const name = typeof fileName === "string" ? fileName.trim() || undefined : undefined;
      const extractedText = await extractDocumentText(pdfBase64, name);
      if (!extractedText) {
        return res.status(400).json({
          error: "No text could be extracted from the file. Try a different file or paste content.",
        });
      }
      result = await smartTutorWithText(
        extractedText,
        level,
        subject.trim(),
        gradeLevel.trim(),
        editInst,
        name || "an uploaded document"
      );
    } else {
      const pasted = String(pastedText ?? "").trim();
      if (!pasted) {
        return res.status(400).json({ error: "pastedText is empty" });
      }
      result = await smartTutorWithText(
        pasted,
        level,
        subject.trim(),
        gradeLevel.trim(),
        editInst
      );
    }

    return res.status(200).json({
      success: true,
      content: stripMarkdownCodeFence(result.content),
      model: result.model,
    });
  } catch (error: unknown) {
    console.error("Smart tutor error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to adapt content",
    });
  }
}
