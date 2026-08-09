import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { deductCreditsForRequest } from "@/lib/ai-credits-deduct";
import { chatComplete, parseJsonResponse } from "@/server/ai/opencode";

function buildEvaluationPrompt(
  test: { subject: string; grades: string[]; curriculum: string[]; experience_years: number; questions_json: unknown },
  answers_json: Record<string, string>,
  teacherId: string
): string {
  return `You are an expert education evaluator and tutor matcher.

Evaluate the teacher's test answers and return a detailed scoring profile.

Teacher profile:
- teacher_id: ${teacherId}
- Subject: ${test.subject}
- Grades: ${(test.grades as string[]).join(", ")}
- Curriculum: ${(test.curriculum as string[]).join(", ")}
- Experience: ${test.experience_years} years

Test questions:
${JSON.stringify(test.questions_json, null, 2)}

Teacher answers:
${JSON.stringify(answers_json, null, 2)}

Your task:
1. Score the teacher from 0 to 100 in each parameter listed below.
2. Identify teaching nature and best student types.
3. Identify strengths and weaknesses.
4. Recommend: approved (score >= 70), needs_review (50-69), rejected (< 50).

Scoring rules:
- 0-30 = weak, 31-50 = below average, 51-70 = average, 71-85 = good, 86-100 = excellent
- Penalize vague or non-specific answers.
- Reward practical, student-centered, clear explanations.
- Do not be overly generous.

Return ONLY this valid JSON, no markdown:
{
  "teacher_id": "${teacherId}",
  "overall_score": 0,
  "subject_scores": {
    "subject_knowledge": 0,
    "concept_clarity": 0,
    "problem_solving": 0,
    "accuracy": 0
  },
  "teaching_style_scores": {
    "conceptual_teaching": 0,
    "exam_focused_teaching": 0,
    "interactive_teaching": 0,
    "step_by_step_explanation": 0,
    "practical_examples": 0
  },
  "personality_scores": {
    "patience": 0,
    "empathy": 0,
    "strictness": 0,
    "friendliness": 0,
    "communication": 0,
    "adaptability": 0
  },
  "student_fit_scores": {
    "beginner_student_fit": 0,
    "weak_student_fit": 0,
    "advanced_student_fit": 0,
    "shy_student_fit": 0,
    "hyperactive_student_fit": 0,
    "exam_pressure_fit": 0
  },
  "preferences": {
    "preferred_grades": [],
    "preferred_subjects": [],
    "preferred_curriculum": [],
    "preferred_student_level": [],
    "preferred_languages": [],
    "availability": [],
    "hourly_rate": 0
  },
  "teacher_nature": "",
  "best_for": [],
  "not_best_for": [],
  "strengths": [],
  "weaknesses": [],
  "summary": "",
  "recommendation": "approved | needs_review | rejected"
}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { user, error: authError } = await getAuthUser(req, res);
  if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

  const { evaluation_test_id, answers_json } = req.body as {
    evaluation_test_id?: string;
    answers_json?: Record<string, string>;
  };
  if (!evaluation_test_id || !answers_json) {
    return res.status(400).json({ error: "evaluation_test_id and answers_json required" });
  }

  if (!supabaseAdmin) return res.status(500).json({ error: "Server configuration error" });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;

  const { data: test, error: testError } = await db
    .from("teacher_evaluation_tests")
    .select("*")
    .eq("id", evaluation_test_id)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (testError || !test) return res.status(404).json({ error: "Evaluation test not found" });
  if (test.status !== "in_progress") {
    return res.status(400).json({ error: "Test must be in_progress to submit answers" });
  }

  // Save answers
  const { error: answerError } = await db
    .from("teacher_evaluation_answers")
    .insert({
      evaluation_test_id,
      teacher_id: user.id,
      answers_json,
      submitted_at: new Date().toISOString(),
    });
  if (answerError) return res.status(500).json({ error: "Failed to save answers" });

  // Mark test completed
  await db
    .from("teacher_evaluation_tests")
    .update({ status: "completed", submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", evaluation_test_id);

  const creditError = await deductCreditsForRequest(user.id, "teacher_evaluation");
  if (creditError) return res.status(creditError.status).json(creditError.body);

  const prompt = buildEvaluationPrompt(
    {
      subject: test.subject as string,
      grades: (test.grades as string[]) ?? [],
      curriculum: (test.curriculum as string[]) ?? [],
      experience_years: (test.experience_years as number) ?? 0,
      questions_json: test.questions_json,
    },
    answers_json,
    user.id
  );

  let raw: string;
  try {
    const completion = await chatComplete({
      prompt,
      system: "You are an expert education evaluator. Return only valid JSON, no markdown.",
      taskType: "teacher_evaluation",
      temperature: 0.3,
      json: true,
    });
    raw = completion.content;
  } catch (error: unknown) {
    console.error("Teacher evaluation error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to evaluate teacher",
    });
  }

  let scores: Record<string, unknown>;
  try {
    scores = parseJsonResponse<Record<string, unknown>>(raw);
  } catch {
    return res.status(500).json({ error: "AI returned invalid JSON", raw: raw.slice(0, 500) });
  }

  const recommendation = (scores.recommendation as string) ?? "needs_review";
  const validRecs = ["approved", "needs_review", "rejected"];
  const safeRec = validRecs.includes(recommendation) ? recommendation : "needs_review";

  const { data: profile, error: profileError } = await db
    .from("teacher_ai_profiles")
    .insert({
      teacher_id: user.id,
      workspace_id: test.workspace_id,
      evaluation_test_id,
      overall_score: scores.overall_score ?? 0,
      subject_scores: scores.subject_scores ?? {},
      teaching_style_scores: scores.teaching_style_scores ?? {},
      personality_scores: scores.personality_scores ?? {},
      student_fit_scores: scores.student_fit_scores ?? {},
      preferences: scores.preferences ?? {},
      teacher_nature: scores.teacher_nature ?? "",
      best_for: scores.best_for ?? [],
      not_best_for: scores.not_best_for ?? [],
      strengths: scores.strengths ?? [],
      weaknesses: scores.weaknesses ?? [],
      summary: scores.summary ?? "",
      recommendation: safeRec,
    })
    .select("id")
    .single();

  if (profileError) return res.status(500).json({ error: "Failed to save AI profile" });

  await db
    .from("teacher_evaluation_tests")
    .update({ status: "evaluated", updated_at: new Date().toISOString() })
    .eq("id", evaluation_test_id);

  return res.status(200).json({
    profile_id: profile.id,
    overall_score: scores.overall_score,
    recommendation: safeRec,
  });
}
