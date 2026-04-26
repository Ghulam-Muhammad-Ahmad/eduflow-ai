import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

export interface EvaluationTest {
  id: string;
  workspace_id: string;
  teacher_id: string;
  subject: string;
  grades: string[];
  curriculum: string[];
  experience_years: number;
  language: string;
  status: "pending" | "in_progress" | "completed" | "evaluated";
  questions_json: {
    test_title: string;
    sections: Array<{
      section_name: string;
      purpose: string;
      questions: Array<{
        question_id: string;
        question_type: "mcq" | "scenario" | "open_ended" | "preference";
        question: string;
        options: string[];
        expected_signal: string;
        scoring_traits: string[];
      }>;
    }>;
  } | null;
  assigned_at: string;
  started_at: string | null;
  submitted_at: string | null;
  created_at: string;
}

export interface TeacherAIProfile {
  id: string;
  teacher_id: string;
  overall_score: number;
  subject_scores: Record<string, number>;
  teaching_style_scores: Record<string, number>;
  personality_scores: Record<string, number>;
  student_fit_scores: Record<string, number>;
  preferences: Record<string, unknown>;
  teacher_nature: string;
  best_for: string[];
  not_best_for: string[];
  strengths: string[];
  weaknesses: string[];
  summary: string;
  recommendation: "approved" | "needs_review" | "rejected";
  owner_reviewed: boolean;
  owner_notes: string | null;
  created_at: string;
}

export function useMyEvaluationTest() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["teacher-evaluation", user?.id],
    queryFn: async () => {
      const res = await fetch("/api/teacher/evaluation");
      if (!res.ok) throw new Error("Failed to fetch evaluation");
      return res.json() as Promise<{ test: EvaluationTest | null; profile: TeacherAIProfile | null }>;
    },
    enabled: !!user,
  });
}

export function useStartEvaluation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (evaluation_test_id: string) => {
      const res = await fetch("/api/teacher/evaluation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evaluation_test_id, status: "in_progress" }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Failed to start evaluation");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-evaluation", user?.id] });
    },
  });
}

export function useSubmitAnswers() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({
      evaluation_test_id,
      answers_json,
    }: {
      evaluation_test_id: string;
      answers_json: Record<string, string>;
    }) => {
      const res = await fetch("/api/ai/evaluate-teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evaluation_test_id, answers_json }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Failed to submit answers");
      }
      return res.json() as Promise<{ profile_id: string; overall_score: number; recommendation: string }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-evaluation", user?.id] });
    },
  });
}
