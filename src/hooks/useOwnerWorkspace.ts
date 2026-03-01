import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type WorkspaceRow = {
  id: string;
  name: string;
  type: "business" | "solo";
  owner_id: string;
  created_at: string;
  updated_at: string;
  settings: Record<string, unknown>;
};

export type WorkspaceMemberRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: "owner" | "tutor";
  created_at: string;
  profile?: { display_name: string | null; email: string | null };
};

/** Current user's workspace as owner (first one). Used only when role is admin. */
export function useOwnerWorkspace() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: workspace,
    isLoading: workspaceLoading,
    error: workspaceError,
  } = useQuery({
    queryKey: ["owner-workspace", user?.id],
    queryFn: async (): Promise<WorkspaceRow | null> => {
      if (!user?.id || role !== "admin") return null;
      const { data, error } = await supabase
        .from("workspaces")
        .select("*")
        .eq("owner_id", user.id)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as WorkspaceRow | null;
    },
    enabled: !!user && role === "admin",
  });

  const workspaceId = workspace?.id ?? null;

  /** Tutors in this workspace (excluding owner) */
  const {
    data: tutors = [],
    isLoading: tutorsLoading,
  } = useQuery({
    queryKey: ["owner-workspace-tutors", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data: rows, error } = await supabase
        .from("workspace_members")
        .select("id, workspace_id, user_id, role, created_at")
        .eq("workspace_id", workspaceId)
        .eq("role", "tutor");
      if (error) throw error;
      if (!rows?.length) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, email")
        .in("user_id", rows.map((r) => r.user_id));
      const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
      return rows.map((r) => ({
        ...r,
        profile: profileMap.get(r.user_id) ?? null,
      })) as WorkspaceMemberRow[];
    },
    enabled: !!workspaceId,
  });

  /** All member user ids (owner + tutors) for this workspace */
  const memberUserIds = workspace
    ? [workspace.owner_id, ...tutors.map((t) => t.user_id)]
    : [];

  /** Students assigned in this workspace (tutor_student_assignments) */
  const {
    data: assignedStudents = [],
    isLoading: studentsLoading,
  } = useQuery({
    queryKey: ["owner-workspace-students", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data: rows, error } = await supabase
        .from("tutor_student_assignments")
        .select("id, workspace_id, tutor_id, student_id, created_at")
        .eq("workspace_id", workspaceId);
      if (error) throw error;
      if (!rows?.length) return [];
      const studentIds = [...new Set(rows.map((r) => r.student_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, email")
        .in("user_id", studentIds);
      const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
      return rows.map((r) => ({
        ...r,
        student: profileMap.get(r.student_id) ?? null,
      }));
    },
    enabled: !!workspaceId,
  });

  /** Classrooms where teacher is in this workspace */
  const {
    data: classrooms = [],
    isLoading: classroomsLoading,
  } = useQuery({
    queryKey: ["owner-workspace-classrooms", workspaceId, memberUserIds],
    queryFn: async () => {
      if (!workspaceId || memberUserIds.length === 0) return [];
      const { data, error } = await supabase
        .from("classrooms")
        .select("*")
        .in("teacher_id", memberUserIds)
        .eq("is_archived", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!workspaceId && memberUserIds.length > 0,
  });

  /** Assignments in workspace (by teacher in workspace) */
  const {
    data: assignments = [],
    isLoading: assignmentsLoading,
  } = useQuery({
    queryKey: ["owner-workspace-assignments", workspaceId, memberUserIds],
    queryFn: async () => {
      if (!workspaceId || memberUserIds.length === 0) return [];
      const { data, error } = await supabase
        .from("assignments")
        .select("*, classrooms(id, name, subject)")
        .in("teacher_id", memberUserIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!workspaceId && memberUserIds.length > 0,
  });

  const assignmentIds = assignments.map((a) => a.id);

  /** Pending submissions (not graded) in workspace */
  const {
    data: pendingSubmissionsCount = 0,
    isLoading: pendingLoading,
  } = useQuery({
    queryKey: ["owner-workspace-pending-submissions", workspaceId, assignmentIds],
    queryFn: async () => {
      if (!workspaceId || assignmentIds.length === 0) return 0;
      const { count, error } = await supabase
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .in("assignment_id", assignmentIds)
        .neq("status", "graded");
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!workspaceId && assignmentIds.length > 0,
  });

  /** Quizzes in workspace */
  const {
    data: quizzes = [],
    isLoading: quizzesLoading,
  } = useQuery({
    queryKey: ["owner-workspace-quizzes", workspaceId, memberUserIds],
    queryFn: async () => {
      if (!workspaceId || memberUserIds.length === 0) return [];
      const { data, error } = await supabase
        .from("quizzes")
        .select("*, classroom:classrooms(id, name, subject)")
        .in("teacher_id", memberUserIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!workspaceId && memberUserIds.length > 0,
  });

  /** Documents uploaded by workspace members */
  const {
    data: documents = [],
    isLoading: documentsLoading,
  } = useQuery({
    queryKey: ["owner-workspace-documents", workspaceId, memberUserIds],
    queryFn: async () => {
      if (!workspaceId || memberUserIds.length === 0) return [];
      const { data, error } = await supabase
        .from("documents")
        .select("id, name, file_type, file_size, created_at, user_id")
        .in("user_id", memberUserIds)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!workspaceId && memberUserIds.length > 0,
  });

  const stats = {
    tutorsCount: tutors.length,
    studentsCount: assignedStudents.length,
    classroomsCount: classrooms.length,
    assignmentsCount: assignments.length,
    quizzesCount: quizzes.length,
    pendingSubmissionsCount,
    documentsCount: documents.length,
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["owner-workspace"] });
  };

  return {
    workspace,
    workspaceId,
    tutors,
    assignedStudents,
    classrooms,
    assignments,
    quizzes,
    documents,
    stats,
    memberUserIds,
    isLoading:
      workspaceLoading ||
      tutorsLoading ||
      studentsLoading ||
      classroomsLoading ||
      assignmentsLoading ||
      quizzesLoading ||
      documentsLoading ||
      pendingLoading,
    error: workspaceError,
    invalidate,
  };
}
