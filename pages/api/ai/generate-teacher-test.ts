import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { deductCreditsForRequest, ensureOwnerWorkspaceCreditPool } from "@/lib/ai-credits-deduct";
import { chatComplete, parseJsonResponse } from "@/server/ai/opencode";

const QUESTION_COUNT = 20;

function buildGenerationPrompt(test: {
  subject: string;
  grades: string[];
  curriculum: string[];
  experience_years: number;
  language: string;
}): string {
  return `You are an expert tutor assessment designer.

Create an evaluation test for a tutor.

Tutor details:
Subject: ${test.subject}
Grade levels: ${test.grades.join(", ")}
Curriculum: ${test.curriculum.join(", ")}
Experience: ${test.experience_years} years
Language: ${test.language}

Create ${QUESTION_COUNT} questions across these sections:
1. Subject Knowledge (5 questions) - tests actual academic ability
2. Teaching Method (5 questions) - tests how the teacher explains
3. Student Handling (4 questions) - tests fit with different student types
4. Personality / Nature (4 questions) - tests behavior and communication
5. Tutor Preferences (2 questions) - captures preferred conditions

Rules:
- Include MCQs, scenario questions, and open-ended questions.
- Questions must help evaluate skill, nature, communication, patience, adaptability, and student fit.
- Do not ask irrelevant personal questions.
- Return only valid JSON, no extra text.

Return this exact JSON structure:
{
  "test_title": "",
  "sections": [
    {
      "section_name": "",
      "purpose": "",
      "questions": [
        {
          "question_id": "",
          "question_type": "mcq | scenario | open_ended | preference",
          "question": "",
          "options": [],
          "expected_signal": "",
          "scoring_traits": []
        }
      ]
    }
  ]
}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { user, error: authError } = await getAuthUser(req, res);
  if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

  const { evaluation_test_id } = req.body as { evaluation_test_id?: string };
  if (!evaluation_test_id) return res.status(400).json({ error: "evaluation_test_id required" });

  if (!supabaseAdmin) return res.status(500).json({ error: "Server configuration error" });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;

  // Verify owner owns the workspace that owns this test
  const { data: ownerWorkspace } = await supabaseAdmin
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!ownerWorkspace) return res.status(403).json({ error: "Not a workspace owner" });

  const { data: test, error: testError } = await db
    .from("teacher_evaluation_tests")
    .select("*")
    .eq("id", evaluation_test_id)
    .eq("workspace_id", ownerWorkspace.id)
    .maybeSingle();

  if (testError || !test) return res.status(404).json({ error: "Evaluation test not found" });
  if (test.status !== "pending") return res.status(400).json({ error: "Test already has questions" });

  await ensureOwnerWorkspaceCreditPool(user.id);

  const creditError = await deductCreditsForRequest(user.id, "teacher_test_generation");
  if (creditError) return res.status(creditError.status).json(creditError.body);

  const prompt = buildGenerationPrompt({
    subject: test.subject as string,
    grades: (test.grades as string[]) ?? [],
    curriculum: (test.curriculum as string[]) ?? [],
    experience_years: (test.experience_years as number) ?? 0,
    language: (test.language as string) ?? "English",
  });

  let raw: string;
  try {
    const completion = await chatComplete({
      prompt,
      system: "You are an expert tutor assessment designer. Always return valid JSON only, no markdown.",
      taskType: "teacher_test_generation",
      temperature: 0.7,
      json: true,
    });
    raw = completion.content;
  } catch (error: unknown) {
    console.error("Teacher test generation error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to generate test questions",
    });
  }

  let questions_json: unknown;
  try {
    questions_json = parseJsonResponse<unknown>(raw);
  } catch {
    return res.status(500).json({ error: "AI returned invalid JSON", raw: raw.slice(0, 500) });
  }

  const { error: updateError } = await db
    .from("teacher_evaluation_tests")
    .update({ questions_json, updated_at: new Date().toISOString() })
    .eq("id", evaluation_test_id);

  if (updateError) return res.status(500).json({ error: "Failed to save questions" });

  return res.status(200).json({ questions_json });
}
