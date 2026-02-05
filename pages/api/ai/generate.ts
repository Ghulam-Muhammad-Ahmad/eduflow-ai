import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";

type AITaskType =
  | "content_generation"
  | "checker"
  | "lesson_planning"
  | "study_materials"
  | "rubric_generation"
  | "quiz_questions"
  | "differentiation"
  | "concept_explanation"
  | "practice_questions"
  | "flashcards"
  | "study_plan";

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

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  if (systemMessage) {
    messages.push({ role: "system", content: systemMessage });
  }
  messages.push({ role: "user", content: prompt });

  const completion = await openai.chat.completions.create({
    model,
    messages,
    temperature: 0.7,
  });

  const content = completion.choices[0]?.message?.content || "";
  const usage = completion.usage;
  const inputTokens =
    usage?.prompt_tokens ?? Math.floor(estimateTokens(prompt + (systemMessage ?? "")) * 0.6);
  const outputTokens =
    usage?.completion_tokens ?? Math.ceil(estimateTokens(content) * 0.4);

  return { content, inputTokens, outputTokens };
};

interface AIGenerateRequest {
  taskType: AITaskType;
  prompt: string;
  systemInstruction?: string;
  model?: string;
  userId: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      taskType,
      prompt,
      systemInstruction,
      model,
      userId,
    }: AIGenerateRequest = req.body;

    if (!taskType || !prompt || !userId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const selectedModel = model || "gpt-4";

    const result = await generateWithOpenAI(prompt, systemInstruction, selectedModel);
    const totalTokens = result.inputTokens + result.outputTokens;
    const cost = calculateCost(selectedModel, result.inputTokens, result.outputTokens);

    return res.status(200).json({
      content: result.content,
      provider: "openai",
      model: selectedModel,
      tokens: totalTokens,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      cost,
      success: true,
    });
  } catch (error: any) {
    console.error("AI generation error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to generate content",
    });
  }
}
