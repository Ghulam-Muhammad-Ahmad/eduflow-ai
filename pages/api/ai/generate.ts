import type { NextApiRequest, NextApiResponse } from "next";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

type AIProvider = "gemini" | "openai";
type AITaskType =
  | "content_generation"
  | "grading"
  | "lesson_planning"
  | "study_materials"
  | "rubric_generation"
  | "quiz_questions"
  | "differentiation"
  | "concept_explanation"
  | "practice_questions"
  | "flashcards"
  | "study_plan";

const TASK_COMPLEXITY: Record<AITaskType, AIProvider> = {
  content_generation: "gemini",
  study_materials: "gemini",
  flashcards: "gemini",
  practice_questions: "gemini",
  concept_explanation: "gemini",
  differentiation: "gemini",
  grading: "openai",
  lesson_planning: "openai",
  rubric_generation: "openai",
  quiz_questions: "openai",
  study_plan: "openai",
};

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key not configured");
  }
  return new GoogleGenerativeAI(apiKey);
};

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
  provider: AIProvider,
  model: string,
  inputTokens: number,
  outputTokens: number
): number => {
  if (provider === "gemini") {
    return 0;
  }

  if (model.includes("gpt-4")) {
    return (inputTokens / 1000) * 0.03 + (outputTokens / 1000) * 0.06;
  } else if (model.includes("gpt-3.5")) {
    return (inputTokens / 1000) * 0.0015 + (outputTokens / 1000) * 0.002;
  }

  return 0;
};

const generateWithGemini = async (
  prompt: string,
  systemInstruction?: string
): Promise<{ content: string; tokens: number }> => {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: systemInstruction || "You are a helpful educational assistant.",
  });

  const inputTokens = estimateTokens(prompt + (systemInstruction || ""));

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  const outputTokens = estimateTokens(text);
  const totalTokens = inputTokens + outputTokens;

  return { content: text, tokens: totalTokens };
};

const generateWithOpenAI = async (
  prompt: string,
  systemMessage?: string,
  model: string = "gpt-4"
): Promise<{ content: string; tokens: number }> => {
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
  const tokens = completion.usage?.total_tokens || estimateTokens(prompt + content);

  return { content, tokens };
};

interface AIGenerateRequest {
  taskType: AITaskType;
  prompt: string;
  systemInstruction?: string;
  model?: string;
  userId: string;
  forceProvider?: AIProvider;
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
      forceProvider,
    }: AIGenerateRequest = req.body;

    if (!taskType || !prompt || !userId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Determine provider
    const provider = forceProvider || TASK_COMPLEXITY[taskType];
    const selectedModel = model || (provider === "openai" ? "gpt-4" : "gemini-pro");

    let result: { content: string; tokens: number };
    let inputTokens = 0;
    let outputTokens = 0;

    if (provider === "gemini") {
      result = await generateWithGemini(prompt, systemInstruction);
      inputTokens = Math.floor(result.tokens * 0.6);
      outputTokens = Math.floor(result.tokens * 0.4);
    } else {
      result = await generateWithOpenAI(prompt, systemInstruction, selectedModel);
      inputTokens = Math.floor(result.tokens * 0.6);
      outputTokens = Math.floor(result.tokens * 0.4);
    }

    const cost = calculateCost(provider, selectedModel, inputTokens, outputTokens);

    return res.status(200).json({
      content: result.content,
      provider,
      model: selectedModel,
      tokens: result.tokens,
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
