import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { deductCreditsForRequest, ensureOwnerWorkspaceCreditPool } from "@/lib/ai-credits-deduct";

const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API key not configured");
  return new OpenAI({ apiKey });
};

interface Requirement {
  subject: string;
  grade: string;
  curriculum: string;
  student_level: string | null;
  student_nature: string[] | null;
  preferred_teaching_style: string | null;
  budget_hourly: number | null;
  availability: string[] | null;
}

interface TeacherProfile {
  id: string;
  teacher_id: string;
  overall_score: number;
  subject_scores: Record<string, number>;
  teaching_style_scores: Record<string, number>;
  personality_scores: Record<string, number>;
  student_fit_scores: Record<string, number>;
  preferences: {
    preferred_subjects?: string[];
    preferred_grades?: string[];
    preferred_curriculum?: string[];
    preferred_student_level?: string[];
    availability?: string[];
    hourly_rate?: number;
  };
  teacher_nature: string;
  best_for: string[];
  strengths: string[];
  summary: string;
}

function normalize(val: unknown): number {
  const n = Number(val ?? 0);
  return isNaN(n) ? 0 : Math.max(0, Math.min(100, n));
}

function scoreMatch(req: Requirement, profile: TeacherProfile): number {
  const prefs = profile.preferences ?? {};

  // Subject match: profile must have answered for this subject
  const subjectScore = profile.overall_score > 0 ? 100 : 0;

  // Grade match: check preferences.preferred_grades contains req.grade
  const grades = (prefs.preferred_grades ?? []).map((g: string) => g.toLowerCase());
  const gradeScore = grades.length === 0 ? 50 : grades.some((g) => req.grade.toLowerCase().includes(g) || g.includes(req.grade.toLowerCase())) ? 100 : 20;

  // Curriculum match
  const currics = (prefs.preferred_curriculum ?? []).map((c: string) => c.toLowerCase());
  const curriculumScore = currics.length === 0 ? 50 : currics.some((c) => req.curriculum.toLowerCase().includes(c) || c.includes(req.curriculum.toLowerCase())) ? 100 : 20;

  // Student level fit
  const levelMap: Record<string, string> = {
    beginner: "beginner_student_fit",
    weak: "weak_student_fit",
    average: "weak_student_fit",
    advanced: "advanced_student_fit",
  };
  const levelKey = req.student_level ? levelMap[req.student_level] : null;
  const studentLevelScore = levelKey ? normalize(profile.student_fit_scores?.[levelKey]) : 50;

  // Student nature fit (avg of all nature fits)
  const natureScores: number[] = [];
  for (const nature of req.student_nature ?? []) {
    const key = `${nature.toLowerCase().replace(/\s+/g, "_")}_student_fit`;
    if (profile.student_fit_scores?.[key] !== undefined) {
      natureScores.push(normalize(profile.student_fit_scores[key]));
    }
  }
  const studentNatureScore = natureScores.length > 0 ? natureScores.reduce((a, b) => a + b, 0) / natureScores.length : 50;

  // Teaching style fit
  const styleWords = (req.preferred_teaching_style ?? "").toLowerCase().split(/\s+/);
  const styleScores: number[] = [];
  for (const word of styleWords) {
    if (word.includes("concept") && profile.teaching_style_scores?.conceptual_teaching) {
      styleScores.push(normalize(profile.teaching_style_scores.conceptual_teaching));
    }
    if ((word.includes("step") || word.includes("slow")) && profile.teaching_style_scores?.step_by_step_explanation) {
      styleScores.push(normalize(profile.teaching_style_scores.step_by_step_explanation));
    }
    if (word.includes("exam") && profile.teaching_style_scores?.exam_focused_teaching) {
      styleScores.push(normalize(profile.teaching_style_scores.exam_focused_teaching));
    }
    if (word.includes("interact") && profile.teaching_style_scores?.interactive_teaching) {
      styleScores.push(normalize(profile.teaching_style_scores.interactive_teaching));
    }
  }
  const teachingStyleScore = styleScores.length > 0 ? styleScores.reduce((a, b) => a + b, 0) / styleScores.length : 50;

  // Availability match
  const profileAvail = (prefs.availability ?? []).map((a: string) => a.toLowerCase());
  const reqAvail = (req.availability ?? []).map((a) => a.toLowerCase());
  let availabilityScore = 50;
  if (reqAvail.length > 0 && profileAvail.length > 0) {
    const matches = reqAvail.filter((r) => profileAvail.some((p) => p.includes(r) || r.includes(p)));
    availabilityScore = (matches.length / reqAvail.length) * 100;
  }

  // Budget match
  let budgetScore = 50;
  if (req.budget_hourly && prefs.hourly_rate) {
    const rate = Number(prefs.hourly_rate);
    budgetScore = rate <= req.budget_hourly ? 100 : Math.max(0, 100 - ((rate - req.budget_hourly) / req.budget_hourly) * 100);
  }

  return (
    subjectScore * 0.25 +
    gradeScore * 0.15 +
    curriculumScore * 0.10 +
    studentLevelScore * 0.15 +
    studentNatureScore * 0.15 +
    teachingStyleScore * 0.10 +
    availabilityScore * 0.05 +
    budgetScore * 0.05
  );
}

function buildMatchingPrompt(
  requirement: Record<string, unknown>,
  tutors: Array<{ teacher_id: string; code_score: number } & Record<string, unknown>>
): string {
  return `You are an expert tutor matching advisor.

Student requirement:
${JSON.stringify(requirement, null, 2)}

Top tutor candidates (pre-scored by code):
${JSON.stringify(tutors, null, 2)}

Rank these tutors from best to worst for this student.

Rules:
- Use provided data and code_score only.
- Do not invent new teacher data.
- Explain why each tutor matches or does not.
- Return ONLY valid JSON, no markdown.

Return:
{
  "best_match": {
    "teacher_id": "",
    "match_score": 0,
    "reason": [],
    "possible_risks": [],
    "owner_note": ""
  },
  "ranked_matches": [
    {
      "teacher_id": "",
      "rank": 1,
      "match_score": 0,
      "reason": []
    }
  ]
}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { user, error: authError } = await getAuthUser(req, res);
  if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

  if (!supabaseAdmin) return res.status(500).json({ error: "Server configuration error" });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;

  const { requirement_id } = req.body as { requirement_id?: string };
  if (!requirement_id) return res.status(400).json({ error: "requirement_id required" });

  const { data: workspace } = await supabaseAdmin
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!workspace) return res.status(403).json({ error: "Not a workspace owner" });

  const { data: requirement, error: reqError } = await db
    .from("student_requirements")
    .select("*")
    .eq("id", requirement_id)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (reqError || !requirement) return res.status(404).json({ error: "Requirement not found" });

  const { data: profiles, error: profilesError } = await db
    .from("teacher_ai_profiles")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("recommendation", "approved");

  if (profilesError) return res.status(500).json({ error: profilesError.message });

  if (!profiles || profiles.length === 0) {
    return res.status(200).json({
      matches: [],
      reason: "no_approved_tutors",
      message: "No approved tutors available. Evaluate and approve tutors first.",
    });
  }

  // Code-based scoring
  const req_ = requirement as unknown as Requirement;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scored = (profiles as any[]).map((p: TeacherProfile) => ({
    ...p,
    code_score: Math.round(scoreMatch(req_, p)),
  }));

  scored.sort((a: { code_score: number }, b: { code_score: number }) => b.code_score - a.code_score);
  const top5 = scored as (TeacherProfile & { code_score: number })[];
  const topSlice = top5.slice(0, 5);

  const codeScores = topSlice.map((t: TeacherProfile & { code_score: number }) => ({ teacher_id: t.teacher_id, code_score: t.code_score }));

  await ensureOwnerWorkspaceCreditPool(user.id);
  const creditError = await deductCreditsForRequest(user.id, "tutor_matching");
  if (creditError) return res.status(creditError.status).json(creditError.body);

  const openai = getOpenAIClient();
  const tutorsForAI = topSlice.map((t) => ({
    teacher_id: t.teacher_id,
    code_score: t.code_score,
    overall_score: t.overall_score,
    teacher_nature: t.teacher_nature,
    best_for: t.best_for,
    strengths: t.strengths,
    student_fit_scores: t.student_fit_scores,
    teaching_style_scores: t.teaching_style_scores,
    personality_scores: t.personality_scores,
    preferences: t.preferences,
    summary: t.summary,
  }));

  const response = await openai.responses.create({
    model: "gpt-4o",
    instructions: "You are an expert tutor matching advisor. Return only valid JSON, no markdown.",
    input: buildMatchingPrompt(requirement as unknown as Record<string, unknown>, tutorsForAI),
    temperature: 0.3,
    truncation: "auto",
  });

  const raw =
    (response as { output_text?: string }).output_text ??
    (Array.isArray((response as { output?: unknown[] }).output)
      ? (response as { output: Array<{ type?: string; text?: string }> }).output
          .map((item) => item.text ?? "")
          .join("")
      : "");

  let aiResult: Record<string, unknown>;
  try {
    const cleaned = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
    aiResult = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    return res.status(500).json({ error: "AI returned invalid JSON", raw: raw.slice(0, 500) });
  }

  const bestMatchTeacherId = (aiResult.best_match as { teacher_id?: string })?.teacher_id ?? topSlice[0]?.teacher_id ?? null;

  const { data: matchRow, error: matchError } = await db
    .from("tutor_matches")
    .insert({
      requirement_id,
      workspace_id: workspace.id,
      ranked_matches: aiResult.ranked_matches ?? [],
      best_match_teacher_id: bestMatchTeacherId,
      ai_explanation: aiResult,
      code_scores: codeScores,
      status: "pending",
    })
    .select("id")
    .single();

  if (matchError) return res.status(500).json({ error: "Failed to save match results" });

  return res.status(200).json({
    match_id: matchRow.id,
    ranked_matches: aiResult.ranked_matches,
    best_match: aiResult.best_match,
    ai_explanation: aiResult,
  });
}
