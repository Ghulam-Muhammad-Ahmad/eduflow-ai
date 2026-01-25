import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { supabase } from '@/integrations/supabase/client';

// AI Provider Types
export type AIProvider = 'gemini' | 'openai';
export type AITaskType = 
  | 'content_generation'
  | 'grading'
  | 'lesson_planning'
  | 'study_materials'
  | 'rubric_generation'
  | 'quiz_questions'
  | 'differentiation'
  | 'concept_explanation'
  | 'practice_questions'
  | 'flashcards'
  | 'study_plan';

// Task complexity mapping - determines which provider to use
const TASK_COMPLEXITY: Record<AITaskType, AIProvider> = {
  // Simple tasks -> Gemini (free)
  content_generation: 'gemini',
  study_materials: 'gemini',
  flashcards: 'gemini',
  practice_questions: 'gemini',
  concept_explanation: 'gemini',
  differentiation: 'gemini',
  
  // Complex tasks -> OpenAI (paid)
  grading: 'openai',
  lesson_planning: 'openai',
  rubric_generation: 'openai',
  quiz_questions: 'openai',
  study_plan: 'openai',
};

// Initialize AI clients
const getGeminiClient = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key not configured');
  }
  return new GoogleGenerativeAI(apiKey);
};

const getOpenAIClient = () => {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }
  return new OpenAI({ apiKey });
};

// Estimate token count (rough approximation)
const estimateTokens = (text: string): number => {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
};

// Calculate cost based on provider and tokens
const calculateCost = (
  provider: AIProvider,
  model: string,
  inputTokens: number,
  outputTokens: number
): number => {
  if (provider === 'gemini') {
    // Gemini free tier - no cost
    return 0;
  }
  
  // OpenAI pricing (as of 2024, adjust as needed)
  if (model.includes('gpt-4')) {
    // GPT-4: $0.03/1K input, $0.06/1K output
    return (inputTokens / 1000) * 0.03 + (outputTokens / 1000) * 0.06;
  } else if (model.includes('gpt-3.5')) {
    // GPT-3.5: $0.0015/1K input, $0.002/1K output
    return (inputTokens / 1000) * 0.0015 + (outputTokens / 1000) * 0.002;
  }
  
  return 0;
};

// Check if user can make AI request
export const checkAIUsageLimit = async (userId: string) => {
  try {
    const { data, error } = await supabase.rpc('can_make_ai_request', {
      _user_id: userId,
    });
    
    if (error) throw error;
    return data as { can_request: boolean; reason?: string; current_usage: number; limit: number; remaining?: number };
  } catch (error: any) {
    console.error('Error checking AI usage limit:', error);
    return { can_request: false, reason: 'Failed to check usage limit', current_usage: 0, limit: 0 };
  }
};

// Record AI interaction in database
const recordInteraction = async (
  userId: string,
  interactionType: AITaskType,
  provider: AIProvider,
  model: string,
  tokensUsed: number,
  cost: number,
  success: boolean,
  errorMessage?: string
) => {
  try {
    await supabase.rpc('record_ai_interaction', {
      _user_id: userId,
      _interaction_type: interactionType,
      _provider: provider,
      _model: model,
      _tokens_used: tokensUsed,
      _cost: cost,
      _success: success,
      _error_message: errorMessage || null,
    });
  } catch (error) {
    console.error('Error recording AI interaction:', error);
  }
};

// Generate content using Gemini
const generateWithGemini = async (
  prompt: string,
  systemInstruction?: string
): Promise<{ content: string; tokens: number }> => {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-pro',
    systemInstruction: systemInstruction || 'You are a helpful educational assistant.',
  });

  const inputTokens = estimateTokens(prompt + (systemInstruction || ''));
  
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();
  
  const outputTokens = estimateTokens(text);
  const totalTokens = inputTokens + outputTokens;

  return { content: text, tokens: totalTokens };
};

// Generate content using OpenAI
const generateWithOpenAI = async (
  prompt: string,
  systemMessage?: string,
  model: string = 'gpt-4'
): Promise<{ content: string; tokens: number }> => {
  const openai = getOpenAIClient();
  
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  if (systemMessage) {
    messages.push({ role: 'system', content: systemMessage });
  }
  messages.push({ role: 'user', content: prompt });

  const completion = await openai.chat.completions.create({
    model,
    messages,
    temperature: 0.7,
  });

  const content = completion.choices[0]?.message?.content || '';
  const tokens = completion.usage?.total_tokens || estimateTokens(prompt + content);

  return { content, tokens };
};

// Main AI service function
export interface AIGenerateOptions {
  taskType: AITaskType;
  prompt: string;
  systemInstruction?: string;
  model?: string;
  userId: string;
  forceProvider?: AIProvider; // Override automatic provider selection
}

export interface AIGenerateResult {
  content: string;
  provider: AIProvider;
  model: string;
  tokens: number;
  cost: number;
  success: boolean;
  error?: string;
}

export const generateAI = async (options: AIGenerateOptions): Promise<AIGenerateResult> => {
  const { taskType, prompt, systemInstruction, model, userId, forceProvider } = options;

  // Check usage limit first
  const usageCheck = await checkAIUsageLimit(userId);
  if (!usageCheck.can_request) {
    return {
      content: '',
      provider: 'gemini',
      model: '',
      tokens: 0,
      cost: 0,
      success: false,
      error: usageCheck.reason || 'Usage limit reached',
    };
  }

  // Determine provider
  const provider = forceProvider || TASK_COMPLEXITY[taskType];
  const selectedModel = model || (provider === 'openai' ? 'gpt-4' : 'gemini-pro');

  try {
    let result: { content: string; tokens: number };
    let inputTokens = 0;
    let outputTokens = 0;

    if (provider === 'gemini') {
      result = await generateWithGemini(prompt, systemInstruction);
      // Rough split for Gemini (no exact token count)
      inputTokens = Math.floor(result.tokens * 0.6);
      outputTokens = Math.floor(result.tokens * 0.4);
    } else {
      result = await generateWithOpenAI(prompt, systemInstruction, selectedModel);
      // OpenAI provides exact token counts, but we estimate here
      inputTokens = Math.floor(result.tokens * 0.6);
      outputTokens = Math.floor(result.tokens * 0.4);
    }

    const cost = calculateCost(provider, selectedModel, inputTokens, outputTokens);

    // Record successful interaction
    await recordInteraction(
      userId,
      taskType,
      provider,
      selectedModel,
      result.tokens,
      cost,
      true
    );

    return {
      content: result.content,
      provider,
      model: selectedModel,
      tokens: result.tokens,
      cost,
      success: true,
    };
  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error';
    
    // Record failed interaction
    await recordInteraction(
      userId,
      taskType,
      provider,
      selectedModel,
      0,
      0,
      false,
      errorMessage
    );

    // Try fallback provider if primary fails
    if (!forceProvider && provider === 'gemini') {
      console.log('Gemini failed, trying OpenAI fallback...');
      return generateAI({
        ...options,
        forceProvider: 'openai',
      });
    }

    return {
      content: '',
      provider,
      model: selectedModel,
      tokens: 0,
      cost: 0,
      success: false,
      error: errorMessage,
    };
  }
};

// Specialized functions for different task types

export const generateContent = async (
  prompt: string,
  userId: string,
  contentType: 'worksheet' | 'discussion_questions' | 'project_ideas'
) => {
  const systemInstruction = `You are an educational content generator. Create ${contentType} that are engaging, age-appropriate, and aligned with educational best practices.`;
  
  return generateAI({
    taskType: 'content_generation',
    prompt,
    systemInstruction,
    userId,
  });
};

export const generateRubric = async (
  assignmentDescription: string,
  userId: string
) => {
  const prompt = `Create a detailed rubric for the following assignment:\n\n${assignmentDescription}\n\nProvide a rubric with at least 4 criteria, each with 4 performance levels (Exemplary, Proficient, Developing, Beginning). Include point values.`;
  
  return generateAI({
    taskType: 'rubric_generation',
    prompt,
    systemInstruction: 'You are an expert in educational assessment. Create clear, fair, and detailed rubrics.',
    userId,
  });
};

export const generateQuizQuestions = async (
  sourceMaterial: string,
  numQuestions: number,
  questionType: 'multiple_choice' | 'true_false' | 'short_answer',
  userId: string
) => {
  const prompt = `Based on the following material, generate ${numQuestions} ${questionType} questions:\n\n${sourceMaterial}\n\nFormat the questions as JSON with the following structure for each question: {question_text, options (for multiple choice), correct_answer, explanation}`;
  
  return generateAI({
    taskType: 'quiz_questions',
    prompt,
    systemInstruction: 'You are an expert in creating educational assessment questions. Generate clear, fair questions that test understanding.',
    userId,
  });
};

export const gradeSubmission = async (
  submissionText: string,
  assignmentDescription: string,
  rubric?: string,
  userId: string
) => {
  const rubricSection = rubric ? `\n\nUse this rubric:\n${rubric}` : '';
  const prompt = `Analyze this student submission for the following assignment:\n\nAssignment: ${assignmentDescription}${rubricSection}\n\nSubmission:\n${submissionText}\n\nProvide:\n1. Grammar and spelling errors\n2. Content analysis\n3. Suggested improvements\n4. Rubric-based scoring suggestions (if rubric provided)\n5. Overall feedback`;
  
  return generateAI({
    taskType: 'grading',
    prompt,
    systemInstruction: 'You are an expert teacher providing constructive feedback. Be specific, encouraging, and focus on learning improvement.',
    userId,
  });
};

export const generateLessonPlan = async (
  subject: string,
  gradeLevel: string,
  topic: string,
  duration: number,
  learningObjectives: string[],
  curriculumStandards?: string[],
  userId: string
) => {
  const standardsSection = curriculumStandards 
    ? `\n\nAlign with these standards:\n${curriculumStandards.join('\n')}`
    : '';
  const prompt = `Create a detailed lesson plan with the following requirements:\n\nSubject: ${subject}\nGrade Level: ${gradeLevel}\nTopic: ${topic}\nDuration: ${duration} minutes\nLearning Objectives:\n${learningObjectives.map(obj => `- ${obj}`).join('\n')}${standardsSection}\n\nInclude:\n1. Introduction/Hook (5-10 min)\n2. Direct Instruction (timing)\n3. Guided Practice (timing)\n4. Independent Practice (timing)\n5. Assessment/Closure (timing)\n6. Materials needed\n7. Differentiation strategies`;
  
  return generateAI({
    taskType: 'lesson_planning',
    prompt,
    systemInstruction: 'You are an expert curriculum designer. Create comprehensive, engaging lesson plans that follow best practices.',
    userId,
  });
};

export const generateStudyMaterials = async (
  sourceMaterial: string,
  materialType: 'summary' | 'flashcards' | 'practice_questions' | 'concept_explanation',
  userId: string
) => {
  const typeInstructions: Record<string, string> = {
    summary: 'Create a concise summary with key points and main ideas.',
    flashcards: 'Create flashcards in Q&A format. Format as JSON array: [{question, answer}]',
    practice_questions: 'Generate practice questions with answers. Format as JSON array: [{question, answer, explanation}]',
    concept_explanation: 'Explain the concepts clearly and simply, with examples.',
  };

  const prompt = `${typeInstructions[materialType]}\n\nSource Material:\n${sourceMaterial}`;
  
  return generateAI({
    taskType: 'study_materials',
    prompt,
    systemInstruction: 'You are a study guide expert. Create clear, helpful study materials that aid learning.',
    userId,
  });
};

export const explainConcept = async (
  concept: string,
  context?: string,
  userId: string
) => {
  const contextSection = context ? `\n\nContext: ${context}` : '';
  const prompt = `Explain this concept in simple, clear terms: ${concept}${contextSection}\n\nProvide:\n1. Simple definition\n2. Key points\n3. Examples\n4. Common misconceptions`;
  
  return generateAI({
    taskType: 'concept_explanation',
    prompt,
    systemInstruction: 'You are an expert teacher who explains complex concepts simply. Use analogies and examples.',
    userId,
  });
};

export const generateStudyPlan = async (
  upcomingAssignments: Array<{ title: string; dueDate: string }>,
  availableTime: number, // hours per week
  userId: string
) => {
  const assignmentsList = upcomingAssignments
    .map(a => `- ${a.title} (Due: ${a.dueDate})`)
    .join('\n');
  
  const prompt = `Create a study plan for the following assignments:\n\n${assignmentsList}\n\nAvailable study time: ${availableTime} hours per week\n\nProvide:\n1. Daily study schedule\n2. Priority order\n3. Time allocation per assignment\n4. Study strategies for each`;
  
  return generateAI({
    taskType: 'study_plan',
    prompt,
    systemInstruction: 'You are a study planning expert. Create realistic, effective study schedules.',
    userId,
  });
};
