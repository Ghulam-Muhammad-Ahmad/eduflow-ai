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
        const { data, error } = await supabase
          .from("classrooms")
          .select("*")
          .eq("teacher_id", user.id)
          .eq("is_archived", false)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return data;
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

// Hook for fetching classroom roster (enrollments)
export const useClassroomRoster = (classroomId: string | null) => {
  return useQuery({
    queryKey: ["classroom-roster", classroomId],
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

      // Fetch profiles, but only select real profile columns (fix for "user_id" error)
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*") // assuming all user columns are on 'profiles'
        .in("user_id", studentIds);

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

// Hook for joining a classroom (student)
export const useJoinClassroom = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (joinCode: string) => {
      if (!user) throw new Error("Not authenticated");

      // Look up classroom by join code
      const { data: classroomData, error: lookupError } = await supabase
        .rpc("get_classroom_by_join_code", { code: joinCode.toUpperCase() });

      if (lookupError) throw lookupError;
      if (!classroomData || classroomData.length === 0) {
        throw new Error("Invalid classroom code");
      }

      const classroom = classroomData[0];

      // Check if already enrolled
      const { data: existingEnrollment } = await supabase
        .from("enrollments")
        .select("id, status")
        .eq("classroom_id", classroom.id)
        .eq("student_id", user.id)
        .maybeSingle();

      if (existingEnrollment) {
        if (existingEnrollment.status === "active") {
          throw new Error("You are already enrolled in this classroom");
        }
        // Reactivate if previously left
        const { error } = await supabase
          .from("enrollments")
          .update({ status: "active", left_at: null })
          .eq("id", existingEnrollment.id);

        if (error) throw error;
      } else {
        // Create new enrollment
        const { error } = await supabase.from("enrollments").insert({
          classroom_id: classroom.id,
          student_id: user.id,
        });

        if (error) throw error;
      }

      return classroom;
    },
    onSuccess: (classroom) => {
      queryClient.invalidateQueries({ queryKey: ["classrooms"] });
      queryClient.invalidateQueries({ queryKey: ["student-enrollments-count"] });
      toast({
        title: "Joined classroom!",
        description: `You are now enrolled in ${classroom.name}.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to join classroom",
        description: error.message,
        variant: "destructive",
      });
    },
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
