import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

type Assignment = Tables<"assignments">;
type AssignmentInsert = TablesInsert<"assignments">;

export const useAssignments = (classroomId?: string) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch assignments for teacher (all their assignments or filtered by classroom)
  const {
    data: assignments,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["assignments", user?.id, classroomId],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from("assignments")
        .select(`
          *,
          classrooms (
            id,
            name,
            subject
          )
        `)
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false });

      if (classroomId) {
        query = query.eq("classroom_id", classroomId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Create assignment
  const createAssignment = useMutation({
    mutationFn: async (
      data: Omit<AssignmentInsert, "teacher_id">
    ) => {
      if (!user) throw new Error("Not authenticated");

      const { data: assignment, error } = await supabase
        .from("assignments")
        .insert({
          ...data,
          teacher_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return assignment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      toast({
        title: "Assignment created",
        description: "Your assignment has been saved as a draft.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error creating assignment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update assignment
  const updateAssignment = useMutation({
    mutationFn: async ({
      id,
      ...data
    }: Partial<Assignment> & { id: string }) => {
      const { data: assignment, error } = await supabase
        .from("assignments")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return assignment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      toast({
        title: "Assignment updated",
        description: "Changes saved successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating assignment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Publish assignment
  const publishAssignment = useMutation({
    mutationFn: async (id: string) => {
      const { data: assignment, error } = await supabase
        .from("assignments")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return assignment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      toast({
        title: "Assignment published",
        description: "Students can now see and submit this assignment.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error publishing assignment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete assignment
  const deleteAssignment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("assignments")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      toast({
        title: "Assignment deleted",
        description: "The assignment has been removed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error deleting assignment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    assignments,
    isLoading,
    error,
    createAssignment,
    updateAssignment,
    publishAssignment,
    deleteAssignment,
  };
};

// Hook for fetching submissions for an assignment
export const useAssignmentSubmissions = (assignmentId: string | null) => {
  return useQuery({
    queryKey: ["assignment-submissions", assignmentId],
    queryFn: async () => {
      if (!assignmentId) return [];

      const { data, error } = await supabase
        .from("submissions")
        .select(`
          *,
          profiles:student_id (
            display_name,
            avatar_url
          )
        `)
        .eq("assignment_id", assignmentId)
        .order("submitted_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!assignmentId,
  });
};

// Hook for student assignments
export const useStudentAssignments = (classroomId?: string) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["student-assignments", user?.id, classroomId],
    queryFn: async () => {
      if (!user) return [];

      // Get assignments from enrolled classrooms
      let query = supabase
        .from("assignments")
        .select(`
          *,
          classrooms (
            id,
            name,
            subject
          ),
          submissions!left (
            id,
            status,
            grade,
            submitted_at
          )
        `)
        .eq("status", "published");

      if (classroomId) {
        query = query.eq("classroom_id", classroomId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Filter to only show assignments for this student's submissions
      return data?.map((assignment) => ({
        ...assignment,
        mySubmission: (assignment.submissions as any[])?.find(
          (s) => s !== null
        ),
      }));
    },
    enabled: !!user,
  });
};
