import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type TutorWorkspaceInfo = {
  workspaceId: string;
  workspaceType: "business" | "solo";
  memberRole: "owner" | "tutor";
  /** In Business mode, only students assigned to this tutor. In Solo, null = show all students in my classrooms. */
  assignedStudentIds: string[] | null;
};

/**
 * For a tutor (role === 'teacher'), returns their workspace and assigned students.
 * - Business workspace + tutor role: assignedStudentIds = only students assigned to this tutor.
 * - Solo workspace (owner is the tutor): assignedStudentIds = null; "My Students" shows all students in their classrooms.
 */
export function useTutorWorkspace() {
  const { user, role } = useAuth();

  const {
    data: tutorWorkspace,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["tutor-workspace", user?.id],
    queryFn: async (): Promise<TutorWorkspaceInfo | null> => {
      if (!user?.id || role !== "teacher") return null;

      const { data: member, error: memberError } = await supabase
        .from("workspace_members")
        .select("workspace_id, role")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (memberError) throw memberError;
      if (!member) return null;

      const { data: workspace, error: wsError } = await supabase
        .from("workspaces")
        .select("id, type")
        .eq("id", member.workspace_id)
        .single();

      if (wsError) throw wsError;
      if (!workspace) return null;

      const workspaceType = (workspace.type as "business" | "solo") ?? "solo";

      // Students come from classrooms + 1v1 rooms (no tutor_student_assignments filter)
      return {
        workspaceId: member.workspace_id,
        workspaceType,
        memberRole: member.role as "owner" | "tutor",
        assignedStudentIds: null,
      };
    },
    enabled: !!user && role === "teacher",
  });

  return {
    tutorWorkspace,
    workspaceId: tutorWorkspace?.workspaceId ?? null,
    isBusinessTutor: tutorWorkspace?.workspaceType === "business" && tutorWorkspace?.memberRole === "tutor",
    assignedStudentIds: tutorWorkspace?.assignedStudentIds ?? null,
    isLoading,
    error,
  };
}

/** Teacher-facing student row. Contact details are deliberately absent. */
export type TutorStudentRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

/**
 * Students visible to the current tutor: assigned only (Business) or all in my classrooms (Solo / no workspace).
 */
export function useTutorStudents() {
  const { user, role } = useAuth();
  const { assignedStudentIds, workspaceId, isLoading: workspaceLoading } = useTutorWorkspace();

  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ["tutor-students", user?.id, assignedStudentIds, workspaceId],
    queryFn: async (): Promise<TutorStudentRow[]> => {
      if (!user?.id || role !== "teacher") return [];

      // Students from (1) classrooms where I'm teacher or in classroom_tutors, (2) 1v1 rooms where I'm tutor
      const [classroomsRes, tutorsRes, oneToOneRes] = await Promise.all([
        supabase.from("classrooms").select("id").eq("teacher_id", user.id).eq("is_archived", false),
        supabase.from("classroom_tutors").select("classroom_id").eq("user_id", user.id),
        supabase.from("one_to_one_rooms").select("student_id").eq("tutor_id", user.id),
      ]);

      const primaryClassIds = (classroomsRes.data ?? []).map((c) => c.id);
      const extraClassIds = (tutorsRes.data ?? [])
        .map((r) => r.classroom_id)
        .filter((id) => !primaryClassIds.includes(id));
      const allClassIds = [...primaryClassIds, ...extraClassIds];

      let studentIds = new Set<string>((oneToOneRes.data ?? []).map((r) => r.student_id));

      if (allClassIds.length > 0) {
        const { data: enrollments, error: enrollError } = await supabase
          .from("enrollments")
          .select("student_id")
          .in("classroom_id", allClassIds)
          .eq("status", "active");
        if (!enrollError && enrollments) {
          enrollments.forEach((e) => studentIds.add(e.student_id));
        }
      }

      if (studentIds.size === 0) return [];

      // Teachers see name + avatar only — student contact details are not exposed.
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", Array.from(studentIds));
      if (profileError) throw profileError;
      return (profiles ?? []).map((p) => ({
        id: p.user_id,
        display_name: p.display_name ?? null,
        avatar_url: p.avatar_url ?? null,
      }));
    },
    enabled: !!user && role === "teacher" && !workspaceLoading,
  });

  return {
    students,
    isLoading: workspaceLoading || studentsLoading,
  };
}

type ClassroomWithName = { id: string; name: string };

/** Map of student id -> list of classroom names they're enrolled in (within the given classrooms). */
export function useTutorStudentClassrooms(
  studentIds: string[],
  classrooms: ClassroomWithName[]
) {
  const classroomIds = classrooms.map((c) => c.id);
  const idToName = new Map(classrooms.map((c) => [c.id, c.name]));

  const { data: map = {} } = useQuery({
    queryKey: ["tutor-student-classrooms", [...studentIds].sort().join(","), [...classroomIds].sort().join(",")],
    queryFn: async (): Promise<Record<string, string[]>> => {
      if (studentIds.length === 0 || classroomIds.length === 0) return {};
      const { data: enrollments, error } = await supabase
        .from("enrollments")
        .select("student_id, classroom_id")
        .in("classroom_id", classroomIds)
        .in("student_id", studentIds)
        .eq("status", "active");
      if (error) throw error;
      const out: Record<string, string[]> = {};
      for (const e of enrollments ?? []) {
        const name = idToName.get(e.classroom_id) ?? e.classroom_id;
        if (!out[e.student_id]) out[e.student_id] = [];
        if (!out[e.student_id].includes(name)) out[e.student_id].push(name);
      }
      return out;
    },
    enabled: studentIds.length > 0 && classroomIds.length > 0,
  });
  return map;
}
