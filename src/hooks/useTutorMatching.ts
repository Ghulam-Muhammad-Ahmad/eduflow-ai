import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

export interface StudentRequirement {
  id: string;
  workspace_id: string;
  student_id: string | null;
  classroom_id: string | null;
  requirement_type: "student" | "class";
  student_name: string;
  subject: string;
  grade: string;
  curriculum: string;
  student_level: "beginner" | "weak" | "average" | "advanced" | null;
  student_nature: string[];
  goal: string | null;
  preferred_teaching_style: string | null;
  language: string;
  budget_hourly: number | null;
  availability: string[];
  status: "open" | "matched" | "closed";
  created_at: string;
}

export interface MatchResult {
  match_id: string;
  ranked_matches: Array<{
    teacher_id: string;
    rank: number;
    match_score: number;
    reason: string[];
  }>;
  best_match: {
    teacher_id: string;
    match_score: number;
    reason: string[];
    possible_risks: string[];
    owner_note: string;
  };
  ai_explanation: Record<string, unknown>;
}

export function useStudentRequirements() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["student-requirements", user?.id],
    queryFn: async () => {
      const res = await fetch("/api/owner/student-requirements");
      if (!res.ok) throw new Error("Failed to fetch requirements");
      const data = await res.json() as { requirements: StudentRequirement[] };
      return data.requirements;
    },
    enabled: !!user,
  });
}

export function useCreateRequirement() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (body: Omit<StudentRequirement, "id" | "workspace_id" | "status" | "created_at" | "requirement_type"> & { requirement_type?: "student" | "class" }) => {
      const res = await fetch("/api/owner/student-requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Failed to create requirement");
      }
      return res.json() as Promise<{ requirement: StudentRequirement }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-requirements", user?.id] });
    },
  });
}

export function useUpdateRequirement() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<StudentRequirement> & { id: string }) => {
      const res = await fetch("/api/owner/student-requirements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Failed to update requirement");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-requirements", user?.id] });
    },
  });
}

export function useDeleteRequirement() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/owner/student-requirements?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Failed to delete requirement");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-requirements", user?.id] });
    },
  });
}

export function useRunMatching() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (requirement_id: string) => {
      const res = await fetch("/api/owner/match-tutors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirement_id }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Failed to run matching");
      }
      return res.json() as Promise<MatchResult | { matches: []; reason: string; message: string }>;
    },
    onSuccess: (_, requirement_id) => {
      queryClient.invalidateQueries({ queryKey: ["tutor-match", requirement_id, user?.id] });
    },
  });
}

export function useAssignEvaluation() {
  return useMutation({
    mutationFn: async (body: {
      teacher_id: string;
      subject: string;
      grades: string[];
      curriculum: string[];
      experience_years?: number;
      language?: string;
    }) => {
      const res = await fetch("/api/owner/assign-evaluation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Failed to assign evaluation");
      }
      return res.json() as Promise<{ test: { id: string } }>;
    },
  });
}

export function useGenerateTeacherTest() {
  return useMutation({
    mutationFn: async (evaluation_test_id: string) => {
      const res = await fetch("/api/ai/generate-teacher-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evaluation_test_id }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Failed to generate test");
      }
      return res.json();
    },
  });
}

export function useTeacherAiProfile(teacherId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["teacher-ai-profile", teacherId, user?.id],
    queryFn: async () => {
      const res = await fetch(`/api/owner/teacher-ai-profile?teacher_id=${teacherId}`);
      if (!res.ok) throw new Error("Failed to fetch AI profile");
      const data = await res.json() as { profile: Record<string, unknown> | null };
      return data.profile;
    },
    enabled: !!teacherId && !!user,
  });
}

export function useReviewAiProfile() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({
      profile_id,
      teacher_id,
      recommendation,
      owner_notes,
    }: {
      profile_id: string;
      teacher_id: string;
      recommendation?: string;
      owner_notes?: string;
    }) => {
      const res = await fetch("/api/owner/teacher-ai-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id, recommendation, owner_notes }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Failed to review profile");
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["teacher-ai-profile", vars.teacher_id, user?.id] });
    },
  });
}

export interface TutorEvaluationRow {
  teacher_id: string;
  profile: { user_id: string; display_name: string | null; email: string | null; avatar_url: string | null };
  latest_test: {
    id: string;
    status: "pending" | "in_progress" | "completed" | "evaluated";
    subject: string;
    grades: string[];
    curriculum: string[];
    created_at: string;
    assigned_at: string;
  } | null;
  ai_profile: {
    id: string;
    overall_score: number;
    recommendation: "approved" | "needs_review" | "rejected";
    owner_reviewed: boolean;
    teacher_nature: string;
    best_for: string[];
    summary: string;
    created_at: string;
  } | null;
}

export function useWorkspaceEvaluations() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["workspace-evaluations", user?.id],
    queryFn: async () => {
      const res = await fetch("/api/owner/workspace-evaluations");
      if (!res.ok) throw new Error("Failed to fetch evaluations");
      return res.json() as Promise<{ evaluations: TutorEvaluationRow[]; approved_count: number }>;
    },
    enabled: !!user,
  });
}
