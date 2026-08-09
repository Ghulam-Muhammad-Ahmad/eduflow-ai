import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import type { AITaskType } from "@/types/ai";
import { deductCreditsForRequest, ensureOwnerWorkspaceCreditPool } from "@/lib/ai-credits-deduct";
import {
  AI_PROVIDER,
  chatComplete,
  extractDocumentText,
  parseJsonResponse,
} from "@/server/ai/opencode";

interface AIGenerateRequest {
  taskType: AITaskType;
  prompt: string;
  systemInstruction?: string;
  model?: string;
  /** For checker task: max points so the model can suggest a grade within range */
  pointsPossible?: number;
  /** For paper/worksheet generation: source document, base64-encoded. Text is extracted server-side. */
  sourcePdfBase64?: string;
  sourcePdfFileName?: string;
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

  try {
    const { user, error: authError } = await getAuthUser(req, res);
    if (authError || !user) {
      return res.status(401).json({ error: authError?.message ?? "Unauthorized" });
    }

    const {
      taskType,
      prompt,
      systemInstruction,
      model,
      pointsPossible,
      sourcePdfBase64,
      sourcePdfFileName,
    }: AIGenerateRequest = req.body;

    if (!taskType || !prompt) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    await ensureOwnerWorkspaceCreditPool(user.id);
    const creditError = await deductCreditsForRequest(user.id, taskType);
    if (creditError) {
      return res.status(creditError.status).json(creditError.body);
    }

    const maxPoints = typeof pointsPossible === "number" && pointsPossible > 0 ? pointsPossible : 100;
    const isCheckerWithGrade = taskType === "checker" && maxPoints > 0;
    const isRubricGeneration = taskType === "rubric_generation";
    const systemMessage = isCheckerWithGrade
      ? (systemInstruction || "You are an expert teacher providing constructive feedback.") +
        ` Respond with ONLY a single JSON object (no markdown, no code block) with exactly: "suggested_grade" (number from 0 to ${maxPoints}), "feedback" (string with your full feedback).`
      : isRubricGeneration
        ? (systemInstruction || "You are an expert in educational assessment.") +
          " Respond with ONLY a valid JSON object. No markdown, no code fence, no explanation—just the raw JSON."
        : systemInstruction;

    // The OpenCode gateway is Chat Completions only, so an attached document is
    // converted to text here and appended to the prompt.
    let finalPrompt = prompt;
    if (typeof sourcePdfBase64 === "string" && sourcePdfBase64.trim()) {
      const fileName = sourcePdfFileName?.trim() || "document.pdf";
      const documentText = await extractDocumentText(sourcePdfBase64, fileName);
      if (!documentText) {
        return res.status(400).json({
          error: "No text could be extracted from the attached document. Try another file or paste the content.",
        });
      }
      finalPrompt = `${prompt}\n\n--- Attached document (${fileName}) ---\n${documentText}\n--- End of document ---`;
    }

    const wantsJson = isCheckerWithGrade || isRubricGeneration;
    const result = await chatComplete({
      prompt: finalPrompt,
      system: systemMessage,
      taskType,
      model,
      json: wantsJson,
    });

    const totalTokens = result.inputTokens + result.outputTokens;

    const payload: Record<string, unknown> = {
      content: result.content,
      provider: AI_PROVIDER,
      model: result.model,
      tokens: totalTokens,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      success: true,
    };
    if (isCheckerWithGrade) {
      try {
        const parsed = parseJsonResponse<{ suggested_grade?: number; feedback?: string }>(result.content);
        if (typeof parsed.suggested_grade === "number" && typeof parsed.feedback === "string") {
          payload.suggested_grade = parsed.suggested_grade;
          payload.feedback = parsed.feedback;
        }
      } catch {
        // leave content only
      }
    }
    return res.status(200).json(payload);
  } catch (error: unknown) {
    console.error("AI generation error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate content",
    });
  }
}
