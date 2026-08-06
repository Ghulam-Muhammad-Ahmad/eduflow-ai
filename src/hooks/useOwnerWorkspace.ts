import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { OneToOneRoomRow } from "@/hooks/useOneToOneRooms";

/** Shape of public.workspaces.settings (jsonb). Persisted to DB on Workspace settings page. */
export type WorkspaceSettings = {
  default_currency?: string;
  /** IANA timezone new sessions are scheduled in by default, e.g. "Europe/London". */
  default_timezone?: string;
  /** Student sidebar item keys (see src/lib/studentNav.ts) hidden by default workspace-wide. */
  student_nav_hidden?: string[];
  [key: string]: unknown;
};

export type WorkspaceRow = {
  id: string;
  name: string;
  type: "business" | "solo";
  owner_id: string;
  created_at: string;
  updated_at: string;
  /** public.workspaces.settings (jsonb). Use default_currency for contract/tutor rate display. */
  settings: WorkspaceSettings;
  logo_url?: string | null;
};

export type WorkspaceMemberRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: "owner" | "tutor";
  created_at: string;
  profile?: { display_name: string | null; email: string | null; avatar_url?: string | null; bio?: string | null };
};

export type AssignedStudentRow = {
  workspace_id: string;
  student_id: string;
  created_at: string;
  /** { nav_hidden?: string[] } — this student's sidebar override, if any. See workspace_students.settings. */
  settings?: { nav_hidden?: string[] } | null;
  student?: { user_id: string; display_name: string | null; email: string | null; avatar_url?: string | null } | null;
};

export type TutorContractRow = {
  id: string;
  workspace_id: string;
  tutor_id: string;
  contract_status: string;
  pay_type: string;
  rate_amount: number;
  rate_currency: string;
  subjects: unknown;
  contract_body_text: string | null;
  contract_storage_path: string | null;
  contract_signed_at: string | null;
  tutor_signature_name: string | null;
  change_requested_at: string | null;
  change_request_note: string | null;
  owner_signature_name: string | null;
  owner_signed_at: string | null;
  updated_at?: string;
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
      const userIds = rows.map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, email, avatar_url, bio")
        .in("user_id", userIds);
      const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
      return rows.map((r) => ({
        ...r,
        profile: profileMap.get(r.user_id) ?? null,
      })) as WorkspaceMemberRow[];
    },
    enabled: !!workspaceId,
  });

  /** Tutor contracts for this workspace (tutor_id -> contract) */
  const {
    data: tutorContracts = [],
    isLoading: contractsLoading,
  } = useQuery({
    queryKey: ["owner-workspace-contracts", workspaceId],
    queryFn: async (): Promise<TutorContractRow[]> => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from("tutor_contracts")
        .select("*")
        .eq("workspace_id", workspaceId);
      if (error) throw error;
      return (data ?? []) as TutorContractRow[];
    },
    enabled: !!workspaceId,
  });

  const contractByTutorId = new Map(tutorContracts.map((c) => [c.tutor_id, c]));

  /** All member user ids (owner + tutors) for this workspace */
  const memberUserIds = workspace
    ? [workspace.owner_id, ...tutors.map((t) => t.user_id)]
    : [];

  /** Students in this workspace (workspace_students) */
  const {
    data: assignedStudents = [],
    isLoading: studentsLoading,
  } = useQuery({
    queryKey: ["owner-workspace-students", workspaceId],
    queryFn: async (): Promise<AssignedStudentRow[]> => {
      if (!workspaceId) return [];
      const { data: rows, error } = await supabase
        .from("workspace_students")
        .select("workspace_id, student_id, created_at, settings")
        .eq("workspace_id", workspaceId);
      if (error) throw error;
      if (!rows?.length) return [];
      const studentIds = [...new Set(rows.map((r) => r.student_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, email, avatar_url")
        .in("user_id", studentIds);
      const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
      return rows.map((r) => ({
        ...r,
        student: profileMap.get(r.student_id) ?? null,
      })) as AssignedStudentRow[];
    },
    enabled: !!workspaceId,
  });

  const workspaceDocumentUserIds = React.useMemo(() => {
    const studentUserIds = assignedStudents.map((row) => row.student_id);
    return Array.from(new Set([...memberUserIds, ...studentUserIds]));
  }, [assignedStudents, memberUserIds]);

  /** Classrooms in this workspace (owner-created, workspace_id set) */
  const {
    data: classrooms = [],
    isLoading: classroomsLoading,
  } = useQuery({
    queryKey: ["owner-workspace-classrooms", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from("classrooms")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("is_archived", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!workspaceId,
  });

  /** classroom_tutors for workspace classrooms (classroom_id -> user_id[]) */
  const classroomIds = classrooms.map((c) => c.id);
  const {
    data: classroomTutorsRows = [],
  } = useQuery({
    queryKey: ["owner-workspace-classroom-tutors", classroomIds],
    queryFn: async () => {
      if (!classroomIds.length) return [];
      const { data, error } = await supabase
        .from("classroom_tutors")
        .select("classroom_id, user_id")
        .in("classroom_id", classroomIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!workspaceId && classroomIds.length > 0,
  });

  /** 1v1 rooms in this workspace (with tutor/student profiles for display) */
  const {
    data: oneToOneRooms = [],
    isLoading: oneToOneRoomsLoading,
  } = useQuery({
    queryKey: ["owner-workspace-one-to-one-rooms", workspaceId],
    queryFn: async (): Promise<OneToOneRoomRow[]> => {
      if (!workspaceId) return [];
      const { data: rows, error } = await supabase
        .from("one_to_one_rooms")
        .select("id, workspace_id, tutor_id, student_id, name, created_at, updated_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!rows?.length) return (rows ?? []) as OneToOneRoomRow[];
      const tutorIds = [...new Set(rows.map((r) => r.tutor_id))];
      const studentIds = [...new Set(rows.map((r) => r.student_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, email, avatar_url")
        .in("user_id", [...tutorIds, ...studentIds]);
      const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
      return rows.map((r) => ({
        ...r,
        tutorProfile: profileMap.get(r.tutor_id) ?? null,
        studentProfile: profileMap.get(r.student_id) ?? null,
      })) as OneToOneRoomRow[];
    },
    enabled: !!workspaceId,
  });

  /** Map classroom_id -> user_id[] for assigned tutors (including primary teacher_id) */
  const tutorsByClassroomId = React.useMemo(() => {
    const map = new Map<string, string[]>();
    for (const c of classrooms) {
      const fromTable = classroomTutorsRows
        .filter((ct) => ct.classroom_id === c.id)
        .map((ct) => ct.user_id);
      const combined = [...new Set([c.teacher_id, ...fromTable])];
      map.set(c.id, combined);
    }
    return map;
  }, [classrooms, classroomTutorsRows]);

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
    queryKey: ["owner-workspace-documents", workspaceId, workspaceDocumentUserIds],
    queryFn: async () => {
      if (!workspaceId || workspaceDocumentUserIds.length === 0) return [];
      const { data, error } = await supabase
        .from("documents")
        .select("id, name, file_type, file_size, created_at, user_id")
        .in("user_id", workspaceDocumentUserIds)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!workspaceId && workspaceDocumentUserIds.length > 0,
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
    queryClient.invalidateQueries({ queryKey: ["owner-workspace-contracts"] });
  };

  /** Create classroom (owner): insert classroom with workspace_id, teacher_id, then classroom_tutors */
  const createClassroom = useMutation({
    mutationFn: async (params: {
      name: string;
      subject: string | null;
      teacher_id: string;
      additionalTutorIds?: string[];
    }) => {
      if (!workspaceId) throw new Error("No workspace");
      const { name, subject, teacher_id, additionalTutorIds = [] } = params;
      const tutorIds = [teacher_id, ...additionalTutorIds.filter((id) => id !== teacher_id)];
      const { data: classroom, error: classError } = await supabase
        .from("classrooms")
        .insert({
          name,
          subject,
          workspace_id: workspaceId,
          teacher_id,
          join_code: null,
        })
        .select()
        .single();
      if (classError) throw classError;
      if (tutorIds.length > 0) {
        const { error: ctError } = await supabase.from("classroom_tutors").insert(
          tutorIds.map((user_id) => ({ classroom_id: classroom.id, user_id }))
        );
        if (ctError) throw ctError;
      }
      return classroom;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-workspace-classrooms"] });
      queryClient.invalidateQueries({ queryKey: ["owner-workspace-classroom-tutors"] });
      queryClient.invalidateQueries({ queryKey: ["classrooms"] });
    },
  });

  /** Update classroom tutors: set primary teacher_id, add/remove from classroom_tutors */
  const updateClassroomTutors = useMutation({
    mutationFn: async (params: {
      classroomId: string;
      teacher_id?: string;
      addTutorIds?: string[];
      removeTutorIds?: string[];
    }) => {
      const { classroomId, teacher_id, addTutorIds = [], removeTutorIds = [] } = params;
      if (teacher_id !== undefined) {
        const { error: upErr } = await supabase
          .from("classrooms")
          .update({ teacher_id })
          .eq("id", classroomId);
        if (upErr) throw upErr;
        await supabase
          .from("classroom_tutors")
          .upsert({ classroom_id: classroomId, user_id: teacher_id }, { onConflict: "classroom_id,user_id" });
      }
      if (addTutorIds.length > 0) {
        const { error: addErr } = await supabase
          .from("classroom_tutors")
          .upsert(
            addTutorIds.map((user_id) => ({ classroom_id: classroomId, user_id })),
            { onConflict: "classroom_id,user_id" }
          );
        if (addErr) throw addErr;
      }
      for (const user_id of removeTutorIds) {
        await supabase.from("classroom_tutors").delete().eq("classroom_id", classroomId).eq("user_id", user_id);
      }
      return { classroomId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-workspace-classrooms"] });
      queryClient.invalidateQueries({ queryKey: ["owner-workspace-classroom-tutors"] });
      queryClient.invalidateQueries({ queryKey: ["classrooms"] });
    },
  });

  /** Add student to classroom (owner): insert enrollment */
  const addStudentToClassroom = useMutation({
    mutationFn: async ({ classroomId, studentId }: { classroomId: string; studentId: string }) => {
      const { error } = await supabase.from("enrollments").insert({
        classroom_id: classroomId,
        student_id: studentId,
      });
      if (error) throw error;
      return { classroomId, studentId };
    },
    onSuccess: ({ classroomId }) => {
      queryClient.invalidateQueries({ queryKey: ["classroom-roster", classroomId] });
      queryClient.invalidateQueries({ queryKey: ["owner-workspace-classrooms"] });
      queryClient.invalidateQueries({ queryKey: ["owner-workspace-students"] });
      queryClient.invalidateQueries({ queryKey: ["classrooms"] });
    },
  });

  /** Create 1v1 room (owner): select existing tutor + student */
  const createOneToOneRoom = useMutation({
    mutationFn: async (params: { tutorId: string; studentId: string; name?: string | null }) => {
      if (!workspaceId) throw new Error("No workspace");
      const { data, error } = await supabase
        .from("one_to_one_rooms")
        .insert({
          workspace_id: workspaceId,
          tutor_id: params.tutorId,
          student_id: params.studentId,
          name: params.name ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-workspace-one-to-one-rooms"] });
      queryClient.invalidateQueries({ queryKey: ["one-to-one-rooms"] });
    },
  });

  /** Update 1v1 room (owner): name, or tutor/student */
  const updateOneToOneRoom = useMutation({
    mutationFn: async (params: { id: string; name?: string | null; tutorId?: string; studentId?: string }) => {
      const { id, ...updates } = params;
      const payload: { name?: string | null; tutor_id?: string; student_id?: string } = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.tutorId !== undefined) payload.tutor_id = updates.tutorId;
      if (updates.studentId !== undefined) payload.student_id = updates.studentId;
      const { data, error } = await supabase.from("one_to_one_rooms").update(payload).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-workspace-one-to-one-rooms"] });
      queryClient.invalidateQueries({ queryKey: ["one-to-one-rooms"] });
    },
  });

  /** Delete 1v1 room (owner) */
  const deleteOneToOneRoom = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("one_to_one_rooms").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-workspace-one-to-one-rooms"] });
      queryClient.invalidateQueries({ queryKey: ["one-to-one-rooms"] });
    },
  });

  const { toast } = useToast();

  /** Update classroom settings (owner). Same shape as teacher useClassrooms. */
  const updateClassroomSettings = useMutation({
    mutationFn: async ({
      id,
      settings: settingsPayload,
    }: {
      id: string;
      settings: {
        allowLateSubmissions?: boolean;
        latePenaltyPercent?: number;
        defaultPointsPossible?: number;
        gradingScale?: string;
      };
    }) => {
      const { data: classroom, error } = await supabase
        .from("classrooms")
        .update({ settings: settingsPayload })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return classroom;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-workspace-classrooms"] });
      queryClient.invalidateQueries({ queryKey: ["classrooms"] });
      toast({ title: "Settings updated", description: "Classroom settings have been saved." });
    },
    onError: (error: Error) => {
      toast({ title: "Error updating settings", description: error.message, variant: "destructive" });
    },
  });

  /** Archive classroom (owner). */
  const archiveClassroom = useMutation({
    mutationFn: async (classroomId: string) => {
      const { error } = await supabase
        .from("classrooms")
        .update({ is_archived: true })
        .eq("id", classroomId);
      if (error) throw error;
      return classroomId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-workspace-classrooms"] });
      queryClient.invalidateQueries({ queryKey: ["classrooms"] });
      toast({ title: "Classroom archived", description: "Students will lose access until it is restored." });
    },
    onError: (error: Error) => {
      toast({ title: "Archive failed", description: error.message, variant: "destructive" });
    },
  });

  return {
    workspace,
    workspaceId,
    tutors,
    assignedStudents,
    oneToOneRooms,
    classrooms,
    tutorsByClassroomId,
    assignments,
    quizzes,
    documents,
    stats,
    memberUserIds,
    tutorContracts,
    contractByTutorId,
    assignmentsLoading,
    quizzesLoading,
    createClassroom,
    updateClassroomTutors,
    addStudentToClassroom,
    createOneToOneRoom,
    updateOneToOneRoom,
    deleteOneToOneRoom,
    updateClassroomSettings,
    archiveClassroom,
    isLoading:
      workspaceLoading ||
      tutorsLoading ||
      contractsLoading ||
      studentsLoading ||
      classroomsLoading ||
      oneToOneRoomsLoading ||
      assignmentsLoading ||
      quizzesLoading ||
      documentsLoading ||
      pendingLoading,
    error: workspaceError,
    invalidate,
  };
}
