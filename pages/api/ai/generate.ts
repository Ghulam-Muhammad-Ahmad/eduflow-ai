import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import { getAuthUser } from "@/integrations/supabase/server";
import type { AITaskType } from "@/types/ai";

const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI API key not configured");
  }
  return new OpenAI({ apiKey });
};

const estimateTokens = (text: string): number => {
  return Math.ceil(text.length / 4);
};

const calculateCost = (
  model: string,
  inputTokens: number,
  outputTokens: number
): number => {
  if (model.includes("gpt-4")) {
    return (inputTokens / 1000) * 0.03 + (outputTokens / 1000) * 0.06;
  } else if (model.includes("gpt-3.5")) {
    return (inputTokens / 1000) * 0.0015 + (outputTokens / 1000) * 0.002;
  }
  return 0;
};

const generateWithOpenAI = async (
  prompt: string,
  systemMessage?: string,
  model: string = "gpt-4"
): Promise<{ content: string; inputTokens: number; outputTokens: number }> => {
  const openai = getOpenAIClient();

  const response = await openai.responses.create({
    model,
    instructions: systemMessage ?? undefined,
    input: prompt,
    temperature: 0.7,
    truncation: "auto",
  });

  const content =
    (response as { output_text?: string }).output_text ??
    (Array.isArray((response as { output?: unknown[] }).output)
      ? (response as { output: Array<{ type?: string; text?: string }> }).output
          .filter((item) => item.type === "message" || item.text)
          .map((item) => item.text ?? "")
          .join("")
      : "") ??
    "";
  const usage = (response as { usage?: { input_tokens?: number; output_tokens?: number } }).usage;
  const inputTokens = usage?.input_tokens ?? Math.floor(estimateTokens(prompt + (systemMessage ?? "")) * 0.6);
  const outputTokens = usage?.output_tokens ?? Math.ceil(estimateTokens(content) * 0.4);

  return { content, inputTokens, outputTokens };
};

/** Paper generation with PDF sent as-is (no text extraction). Uses Responses API with base64 input_file (no PDF-to-text conversion). */
const generateWithOpenAIPdf = async (
  prompt: string,
  systemMessage: string,
  pdfBase64: string,
  filename: string,
  model: string
): Promise<{ content: string; inputTokens: number; outputTokens: number }> => {
  const client = getOpenAIClient();

  const base64String = pdfBase64.startsWith("data:")
    ? pdfBase64.replace(/^data:application\/pdf;base64,/, "")
    : pdfBase64;
  const fileData = `data:application/pdf;base64,${base64String}`;

  const response = await client.responses.create({
    model: model === "gpt-4" ? "gpt-4o" : model,
    instructions: systemMessage,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_file",
            filename,
            file_data: fileData,
          },
          {
            type: "input_text",
            text: prompt,
          },
        ],
      },
    ],
    temperature: 0.7,
    truncation: "auto",
  });

  const content =
    (response as { output_text?: string }).output_text ??
    (Array.isArray((response as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> }).output)
      ? (response as { output: Array<{ content?: Array<{ type?: string; text?: string }> }> }).output
          .flatMap((o) => o.content ?? [])
          .find((c) => c.type === "output_text")
          ?.text ?? ""
      : "") ??
    "";
  const usage = (response as { usage?: { input_tokens?: number; output_tokens?: number } }).usage;
  const inputTokens = usage?.input_tokens ?? 0;
  const outputTokens = usage?.output_tokens ?? 0;

  return { content, inputTokens, outputTokens };
};

interface AIGenerateRequest {
  taskType: AITaskType;
  prompt: string;
  systemInstruction?: string;
  model?: string;
  /** For checker task: max points so the model can suggest a grade within range */
  pointsPossible?: number;
  /** For paper_generation: send PDF as-is (no text extraction). Model must support PDF (e.g. gpt-4o). */
  sourcePdfBase64?: string;
  sourcePdfFileName?: string;
}

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

    const selectedModel = model || "gpt-4";
    const isPaperWithPdf = taskType === "paper_generation" && sourcePdfBase64 && typeof sourcePdfBase64 === "string";
    const isWorksheetWithPdf = taskType === "worksheet_generation" && sourcePdfBase64 && typeof sourcePdfBase64 === "string";
    const isPdfTask = isPaperWithPdf || isWorksheetWithPdf;

    const maxPoints = typeof pointsPossible === "number" && pointsPossible > 0 ? pointsPossible : 100;
    const isCheckerWithGrade = taskType === "checker" && maxPoints > 0;
    const isRubricGeneration = taskType === "rubric_generation";
    const checkerSystem = isCheckerWithGrade
      ? (systemInstruction || "You are an expert teacher providing constructive feedback.") +
        ` Respond with ONLY a single JSON object (no markdown, no code block) with exactly: "suggested_grade" (number from 0 to ${maxPoints}), "feedback" (string with your full feedback).`
      : isRubricGeneration
        ? (systemInstruction || "You are an expert in educational assessment.") +
          " Respond with ONLY a valid JSON object. No markdown, no code fence, no explanation—just the raw JSON."
        : systemInstruction;

    const result = isPdfTask
      ? await generateWithOpenAIPdf(
          prompt,
          checkerSystem ?? systemInstruction ?? "",
          sourcePdfBase64,
          sourcePdfFileName?.trim() || "document.pdf",
          selectedModel
        )
      : await generateWithOpenAI(prompt, checkerSystem, selectedModel);
    const totalTokens = result.inputTokens + result.outputTokens;
    const cost = calculateCost(selectedModel, result.inputTokens, result.outputTokens);

    const payload: Record<string, unknown> = {
      content: result.content,
      provider: "openai",
      model: selectedModel,
      tokens: totalTokens,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      cost,
      success: true,
    };
    if (isCheckerWithGrade) {
      try {
        const raw = result.content.trim().replace(/^```json?\s*|\s*```$/g, "");
        const parsed = JSON.parse(raw) as { suggested_grade?: number; feedback?: string };
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
