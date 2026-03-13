import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

type Assignment = Tables<"assignments">;
type AssignmentInsert = TablesInsert<"assignments">;

export const useAssignments = (classroomId?: string, oneToOneRoomId?: string) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch assignments for teacher (all their assignments or filtered by classroom / 1v1 room)
  const {
    data: assignments,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["assignments", user?.id, classroomId, oneToOneRoomId],
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
          ),
          one_to_one_rooms (
            id,
            name,
            tutor_id,
            student_id
          )
        `)
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false });

      if (classroomId) {
        query = query.eq("classroom_id", classroomId);
      }
      if (oneToOneRoomId) {
        query = query.eq("one_to_one_room_id", oneToOneRoomId);
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

  // Fetch teacher's documents (for attaching to assignments)
  const { data: teacherDocuments = [] } = useQuery({
    queryKey: ["teacher-documents", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("documents")
        .select("id, name, file_type, created_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Add documents to an assignment
  const addAssignmentAttachments = async (
    assignmentId: string,
    documentIds: string[]
  ): Promise<boolean> => {
    if (documentIds.length === 0) return true;
    const rows = documentIds.map((document_id) => ({
      assignment_id: assignmentId,
      document_id,
    }));
    const { error } = await supabase.from("assignment_attachments").insert(rows);
    if (error) {
      toast({
        title: "Error attaching documents",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
    queryClient.invalidateQueries({ queryKey: ["assignments"] });
    return true;
  };

  return {
    assignments,
    isLoading,
    error,
    createAssignment,
    updateAssignment,
    publishAssignment,
    deleteAssignment,
    teacherDocuments,
    addAssignmentAttachments,
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

// Hook for student assignments (classroom and 1v1 room assignments)
export const useStudentAssignments = (classroomId?: string, oneToOneRoomId?: string) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["student-assignments", user?.id, classroomId, oneToOneRoomId],
    queryFn: async () => {
      if (!user) return [];

      const enrolledClassroomIds: string[] = [];
      const { data: enrollments, error: enrollError } = await supabase
        .from("enrollments")
        .select("classroom_id")
        .eq("student_id", user.id)
        .eq("status", "active");
      if (!enrollError && enrollments) {
        enrolledClassroomIds.push(...enrollments.map((e) => e.classroom_id));
      }

      const oneToOneRoomIds: string[] = [];
      const { data: rooms, error: roomsError } = await supabase
        .from("one_to_one_rooms")
        .select("id")
        .eq("student_id", user.id);
      if (!roomsError && rooms) {
        oneToOneRoomIds.push(...rooms.map((r) => r.id));
      }

      const orParts: string[] = [];
      if (enrolledClassroomIds.length) orParts.push(`classroom_id.in.(${enrolledClassroomIds.join(",")})`);
      if (oneToOneRoomIds.length) orParts.push(`one_to_one_room_id.in.(${oneToOneRoomIds.join(",")})`);
      if (orParts.length === 0) return [];

      let query = supabase
        .from("assignments")
        .select(`
          *,
          classrooms (id, name, subject),
          one_to_one_rooms (id, name, tutor_id, student_id),
          assignment_attachments (
            document_id,
            documents (id, name, file_path, file_type)
          )
        `)
        .eq("status", "published")
        .or(orParts.join(","))
        .order("due_date", { ascending: true, nullsFirst: false });

      if (classroomId) query = query.eq("classroom_id", classroomId);
      if (oneToOneRoomId) query = query.eq("one_to_one_room_id", oneToOneRoomId);

      const { data: assignmentsData, error } = await query;
      if (error) throw error;
      const list = assignmentsData ?? [];

      const assignmentIds = list.map((a) => a.id);
      if (assignmentIds.length === 0) return [];

      const { data: submissions } = await supabase
        .from("submissions")
        .select("*")
        .eq("student_id", user.id)
        .in("assignment_id", assignmentIds);

      return list.map((assignment) => ({
        ...assignment,
        mySubmission: submissions?.find((s) => s.assignment_id === assignment.id) ?? null,
      }));
    },
    enabled: !!user,
  });
};
