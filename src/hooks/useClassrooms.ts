import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

type Classroom = Tables<"classrooms">;
type ClassroomInsert = TablesInsert<"classrooms">;

export const useClassrooms = () => {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch classrooms based on role
  const {
    data: classrooms,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["classrooms", user?.id, role],
    queryFn: async () => {
      if (!user) return [];

      if (role === "teacher") {
        const [primaryRes, tutorsRes] = await Promise.all([
          supabase
            .from("classrooms")
            .select("*")
            .eq("teacher_id", user.id)
            .eq("is_archived", false)
            .order("created_at", { ascending: false }),
          supabase
            .from("classroom_tutors")
            .select("classroom_id")
            .eq("user_id", user.id),
        ]);
        if (primaryRes.error) throw primaryRes.error;
        const primary = primaryRes.data ?? [];
        const primaryIds = new Set(primary.map((c) => c.id));
        const extraIds = (tutorsRes.data ?? [])
          .map((r) => r.classroom_id)
          .filter((id) => !primaryIds.has(id));
        if (extraIds.length === 0) return primary;
        const { data: extra, error: extraErr } = await supabase
          .from("classrooms")
          .select("*")
          .in("id", extraIds)
          .eq("is_archived", false)
          .order("created_at", { ascending: false });
        if (extraErr) throw extraErr;
        const combined = [...primary, ...(extra ?? [])];
        combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return combined;
      } else if (role === "student") {
        const { data, error } = await supabase
          .from("enrollments")
          .select(`
            classroom_id,
            joined_at,
            classrooms (*)
          `)
          .eq("student_id", user.id)
          .eq("status", "active");

        if (error) throw error;
        return data?.map((e) => e.classrooms).filter(Boolean) as Classroom[];
      }

      return [];
    },
    enabled: !!user && !!role,
  });

  // Create classroom (teacher only)
  const createClassroom = useMutation({
    mutationFn: async (data: Omit<ClassroomInsert, "teacher_id" | "join_code">) => {
      if (!user) throw new Error("Not authenticated");

      // Generate join code via database function
      const { data: joinCode, error: codeError } = await supabase.rpc("generate_join_code");
      if (codeError) throw codeError;

      const { data: classroom, error } = await supabase
        .from("classrooms")
        .insert({
          ...data,
          teacher_id: user.id,
          join_code: joinCode,
        })
        .select()
        .single();

      if (error) throw error;
      return classroom;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classrooms"] });
      toast({
        title: "Classroom created",
        description: "Your new classroom is ready.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error creating classroom",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update classroom
  const updateClassroom = useMutation({
    mutationFn: async ({
      id,
      ...data
    }: Partial<Classroom> & { id: string }) => {
      const { data: classroom, error } = await supabase
        .from("classrooms")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return classroom;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classrooms"] });
      toast({
        title: "Classroom updated",
        description: "Changes saved successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating classroom",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Archive classroom
  const archiveClassroom = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("classrooms")
        .update({ is_archived: true })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classrooms"] });
      toast({
        title: "Classroom archived",
        description: "The classroom has been archived.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error archiving classroom",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Remove student from classroom
  const removeStudent = useMutation({
    mutationFn: async ({ enrollmentId, classroomId }: { enrollmentId: string; classroomId: string }) => {
      const { error } = await supabase
        .from("enrollments")
        .update({
          status: "removed",
          left_at: new Date().toISOString()
        })
        .eq("id", enrollmentId);

      if (error) throw error;
      return { enrollmentId, classroomId };
    },
    onSuccess: ({ classroomId }) => {
      queryClient.invalidateQueries({ queryKey: ["classroom-roster", classroomId] });
      toast({
        title: "Student removed",
        description: "The student has been removed from the classroom.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error removing student",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update classroom settings
  const updateClassroomSettings = useMutation({
    mutationFn: async ({
      id,
      settings,
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
        .update({ settings })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return classroom;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classrooms"] });
      toast({
        title: "Settings updated",
        description: "Classroom settings have been saved.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    classrooms,
    isLoading,
    error,
    createClassroom,
    updateClassroom,
    archiveClassroom,
    removeStudent,
    updateClassroomSettings,
  };
};

// Hook for fetching student counts per classroom (for list views)
export const useClassroomStudentCounts = (classroomIds: string[]) => {
  return useQuery({
    queryKey: ["classroom-student-counts", [...classroomIds].sort().join(",")],
    queryFn: async (): Promise<Record<string, number>> => {
      if (classroomIds.length === 0) return {};
      const { data, error } = await supabase
        .from("enrollments")
        .select("classroom_id")
        .in("classroom_id", classroomIds)
        .eq("status", "active");
      if (error) throw error;
      const count: Record<string, number> = {};
      for (const row of data ?? []) {
        count[row.classroom_id] = (count[row.classroom_id] ?? 0) + 1;
      }
      return count;
    },
    enabled: classroomIds.length > 0,
  });
};

/** Columns of `profiles` the roster needs. Contact details are opt-in — see below. */
const ROSTER_PROFILE_COLUMNS = "user_id, display_name, avatar_url";

type RosterProfile = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  /** Only present when the caller passed `includeContact`. */
  email?: string | null;
};

/**
 * Hook for fetching classroom roster (enrollments).
 *
 * `includeContact` adds the student's email to each profile. It defaults to false so
 * teacher-facing screens never pull contact details; only owner screens opt in. The flag
 * is part of the query key — sharing one cache entry between an owner and a teacher view
 * would otherwise let whichever mounted first decide what both of them see.
 */
export const useClassroomRoster = (
  classroomId: string | null,
  options?: { includeContact?: boolean }
) => {
  const includeContact = options?.includeContact ?? false;
  return useQuery({
    queryKey: ["classroom-roster", classroomId, includeContact],
    queryFn: async () => {
      if (!classroomId) return [];

      // Fetch enrollments
      const { data: enrollments, error: enrollError } = await supabase
        .from("enrollments")
        .select("id, student_id, joined_at, status")
        .eq("classroom_id", classroomId)
        .eq("status", "active")
        .order("joined_at", { ascending: false });

      if (enrollError) throw enrollError;
      if (!enrollments || enrollments.length === 0) return [];

      // Fetch profiles for all student IDs
      const studentIds = enrollments.map((e) => e.student_id);

      // Defensive: don't run query if no student IDs
      if (!studentIds.length) return enrollments.map(e => ({ ...e, profiles: null }));

      // The select list is built at runtime, so PostgREST can't infer the row shape here.
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select(includeContact ? `${ROSTER_PROFILE_COLUMNS}, email` : ROSTER_PROFILE_COLUMNS)
        .in("user_id", studentIds)
        .returns<RosterProfile[]>();

      if (profilesError) throw profilesError;

      // Merge enrollments with profiles
      const roster = enrollments.map((enrollment) => ({
        ...enrollment,
        profiles: profiles?.find((p) => p.user_id === enrollment.student_id) || null,
      }));

      return roster;
    },
    enabled: !!classroomId,
  });
};


// Hook for leaving a classroom (student)
export const useLeaveClassroom = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (classroomId: string) => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("enrollments")
        .update({
          status: "left",
          left_at: new Date().toISOString(),
        })
        .eq("classroom_id", classroomId)
        .eq("student_id", user.id);

      if (error) throw error;
      return classroomId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classrooms"] });
      queryClient.invalidateQueries({ queryKey: ["student-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["student-enrollments-count"] });
      toast({
        title: "Left classroom",
        description: "You have been unenrolled from the classroom.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to leave classroom",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
