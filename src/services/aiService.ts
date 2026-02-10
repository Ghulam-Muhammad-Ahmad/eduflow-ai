import { supabase } from '@/integrations/supabase/client';
import type { AITaskType } from '@/types/ai';

// AI Provider Types - OpenAI only
export type AIProvider = 'openai';
export type { AITaskType } from '@/types/ai';

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

// Main AI service function
export interface AIGenerateOptions {
  taskType: AITaskType;
  prompt: string;
  systemInstruction?: string;
  model?: string;
  userId: string;
  /** For checker: max points so the model suggests a grade in range [0, pointsPossible] */
  pointsPossible?: number;
}

export interface AIGenerateResult {
  content: string;
  provider: AIProvider;
  model: string;
  tokens: number;
  cost: number;
  success: boolean;
  error?: string;
  /** Set when taskType is checker and API returns structured response */
  suggested_grade?: number;
  feedback?: string;
}

export const generateAI = async (options: AIGenerateOptions): Promise<AIGenerateResult> => {
  const { taskType, prompt, systemInstruction, model, userId, pointsPossible } = options;

  // Check usage limit first
  const usageCheck = await checkAIUsageLimit(userId);
  if (!usageCheck.can_request) {
    return {
      content: '',
      provider: 'openai',
      model: '',
      tokens: 0,
      cost: 0,
      success: false,
      error: usageCheck.reason || 'Usage limit reached',
    };
  }

  try {
    // Call Next.js API route (OpenAI only)
    const body: Record<string, unknown> = {
      taskType,
      prompt,
      systemInstruction,
      model,
      userId,
    };
    if (taskType === 'checker' && pointsPossible != null) {
      body.pointsPossible = pointsPossible;
    }
    const response = await fetch('/api/ai/generate', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to generate content');
    }

    const result = await response.json();

    // Record successful interaction
    await recordInteraction(
      userId,
      taskType,
      result.provider,
      result.model,
      result.tokens,
      result.cost,
      true
    );

    return {
      ...result,
      suggested_grade: result.suggested_grade,
      feedback: result.feedback,
    };
  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error';
    const selectedModel = model || 'gpt-4';

    // Record failed interaction
    await recordInteraction(
      userId,
      taskType,
      'openai',
      selectedModel,
      0,
      0,
      false,
      errorMessage
    );

    return {
      content: '',
      provider: 'openai',
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
  let prompt: string;
  
  if (questionType === 'multiple_choice') {
    prompt = `Based on the following material, generate ${numQuestions} multiple choice questions:\n\n${sourceMaterial}\n\nFormat the questions as a JSON array where EACH question has this exact structure:\n{\n  "question_text": "the question",\n  "options": [\n    {"text": "option 1", "is_correct": false},\n    {"text": "option 2", "is_correct": true},\n    {"text": "option 3", "is_correct": false},\n    {"text": "option 4", "is_correct": false}\n  ],\n  "explanation": "explain why the correct answer is right"\n}\n\nIMPORTANT: Exactly ONE option must have "is_correct": true. Place the correct answer in random positions, not always the same position.`;
  } else if (questionType === 'true_false') {
    prompt = `Based on the following material, generate ${numQuestions} true/false questions:\n\n${sourceMaterial}\n\nFormat the questions as a JSON array where EACH question has this exact structure:\n{\n  "question_text": "the question statement",\n  "correct_answer": "true" or "false",\n  "explanation": "explain why the statement is true or false"\n}\n\nMix the true and false answers - don't make them all one or the other.`;
  } else {
    // short_answer
    prompt = `Based on the following material, generate ${numQuestions} short answer questions:\n\n${sourceMaterial}\n\nFormat the questions as a JSON array where EACH question has this exact structure:\n{\n  "question_text": "the question",\n  "correct_answer": "the expected answer or key points to look for",\n  "explanation": "explain what a good answer should include"\n}\n\nCreate clear, specific questions with well-defined answers.`;
  }
  
  return generateAI({
    taskType: 'quiz_questions',
    prompt,
    systemInstruction: 'You are an expert in creating educational assessment questions. Generate clear, fair questions that test understanding. Always provide well-reasoned explanations for correct answers.',
    userId,
  });
};

export const gradeSubmission = async (
  submissionText: string,
  assignmentDescription: string,
  rubric: string | undefined,
  userId: string,
  pointsPossible: number = 100
) => {
  const rubricSection = rubric ? `\n\nUse this rubric:\n${rubric}` : '';
  const prompt = `Analyze this student submission for the following assignment:\n\nAssignment: ${assignmentDescription}${rubricSection}\n\nSubmission:\n${submissionText}\n\nProvide a suggested grade (0–${pointsPossible}) and detailed feedback. Include: grammar/spelling errors, content analysis, suggested improvements, and overall feedback.`;
  
  return generateAI({
    taskType: 'checker',
    prompt,
    systemInstruction: 'You are an expert teacher providing constructive feedback. Be specific, encouraging, and focus on learning improvement.',
    userId,
    pointsPossible,
  });
};

/** Suggest a grade for a single short-answer quiz question. Returns suggested_grade (0 to pointsPossible) and feedback. */
export const suggestShortAnswerGrade = async (
  questionText: string,
  studentAnswer: string | string[],
  pointsPossible: number,
  userId: string,
  correctAnswer?: string | null
) => {
  const studentAnswerStr = Array.isArray(studentAnswer) ? studentAnswer.join(', ') : String(studentAnswer ?? '');
  const refSection = correctAnswer
    ? `\nReference or model answer (use to compare, but grade on merit): ${correctAnswer}`
    : '';
  const prompt = `Grade this short-answer quiz response.\n\nQuestion: ${questionText}${refSection}\n\nStudent's answer: ${studentAnswerStr}\n\nGive a suggested grade from 0 to ${pointsPossible} (whole number or half points) and brief feedback. Consider correctness, completeness, and clarity.`;
  return generateAI({
    taskType: 'checker',
    prompt,
    systemInstruction: 'You are an expert teacher grading short-answer questions. Be fair and consistent. Respond with suggested_grade (number 0 to max points) and feedback (string).',
    userId,
    pointsPossible,
  });
};

// --- Syllabus → Lesson Plan (content + constraints → structured plan) ---
export interface SyllabusLessonInput {
  text: string;
  subject: string;
  gradeLevel?: string;
  curriculum?: string;
  teachingLevel?: 'beginner' | 'intermediate' | 'advanced';
  totalWeeks: number;
  hoursPerWeek: number;
  classDurationMinutes: number;
  daysAvailable?: string[];
  teachingStyle?: 'concept-based' | 'practice-heavy' | 'revision-focused';
  editPrompt?: string;
}

export interface SyllabusLessonItem {
  lessonNo: number;
  title: string;
  learningObjectives?: string[];
  durationMinutes: number;
  topics?: string[];
  activities?: string;
  teachingNotes?: string;
  isRevision?: boolean;
}

export interface SyllabusLessonPlanResult {
  lessons: SyllabusLessonItem[];
  weeklyDistribution: Record<string, number[]>;
  confidence: 'full' | 'tight' | 'insufficient';
  summary: string;
  message: string | null;
}

export const generateLessonPlanFromSyllabus = async (
  input: SyllabusLessonInput,
  userId: string
): Promise<{
  success: boolean;
  plan?: SyllabusLessonPlanResult;
  error?: string;
  tokens?: number;
}> => {
  const usageCheck = await checkAIUsageLimit(userId);
  if (!usageCheck.can_request) {
    return {
      success: false,
      error: usageCheck.reason || 'Usage limit reached',
    };
  }
  try {
    const response = await fetch('/api/ai/lesson-plan-from-syllabus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, userId }),
    });
    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.error || 'Request failed' };
    }
    if (!data.success || !data.plan) {
      return { success: false, error: data.error || 'Invalid response' };
    }
    const tokens = data.tokens ?? 0;
    const inputT = data.inputTokens ?? 0;
    const outputT = data.outputTokens ?? 0;
    const cost = (inputT / 1000) * 0.03 + (outputT / 1000) * 0.06;
    await recordInteraction(userId, 'lesson_planning', 'openai', 'gpt-4', tokens, cost, true);
    return { success: true, plan: data.plan, tokens };
  } catch (e: any) {
    await recordInteraction(userId, 'lesson_planning', 'openai', 'gpt-4', 0, 0, false, e.message);
    return { success: false, error: e.message || 'Failed to generate plan' };
  }
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

// --- Lesson Planner Calendar: parse natural language to suggested events ---
export interface CalendarEventSuggestion {
  title: string;
  start: string; // ISO date-time
  end: string;   // ISO date-time
  allDay?: boolean;
  description?: string;
}

const CALENDAR_SYSTEM = `You are a calendar assistant for teachers. The user will describe events they want to add (e.g. "daily for next 10 days at 10 pm", "every Monday at 9am for the next month", "meeting tomorrow 2pm to 3pm").
Respond with ONLY a valid JSON array of events, no other text or markdown. Each object must have: title (string), start (ISO 8601 date-time), end (ISO 8601 date-time), and optionally allDay (boolean), description (string).
Include a short description when it helps: e.g. lesson topic, materials needed, or notes. Use the current date/time when relative times are given. For recurring intent (e.g. "daily for 10 days"), expand into separate event objects and vary descriptions per occurrence if useful (e.g. "Day 1: intro", "Day 2: practice").`;

export const suggestCalendarEventsFromPrompt = async (
  userPrompt: string,
  userId: string
): Promise<{ success: boolean; events?: CalendarEventSuggestion[]; error?: string }> => {
  if (!userPrompt?.trim()) {
    return { success: false, error: 'Please describe the events you want.' };
  }
  const prompt = `Current date and time: ${new Date().toISOString()}\n\nUser request: ${userPrompt.trim()}\n\nReturn ONLY a JSON array of event objects.`;
  const result = await generateAI({
    taskType: 'content_generation',
    prompt,
    systemInstruction: CALENDAR_SYSTEM,
    userId,
  });
  if (!result.success || !result.content) {
    return { success: false, error: result.error || 'Failed to generate suggestions.' };
  }
  try {
    const raw = result.content.trim().replace(/^```json?\s*|\s*```$/g, '');
    const parsed = JSON.parse(raw) as unknown;
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    const events: CalendarEventSuggestion[] = arr
      .filter((e: any) => e && typeof e.title === 'string' && e.start && e.end)
      .map((e: any) => ({
        title: String(e.title),
        start: new Date(e.start).toISOString(),
        end: new Date(e.end).toISOString(),
        allDay: Boolean(e.allDay),
        description: e.description ? String(e.description) : undefined,
      }));
    return { success: true, events };
  } catch {
    return { success: false, error: 'Could not parse AI response as event list.' };
  }
};
