import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

type Submission = Tables<"submissions">;
type SubmissionInsert = TablesInsert<"submissions">;

// Hook for student to manage their submissions
export const useStudentSubmissions = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all submissions for the current student
  const {
    data: submissions,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["my-submissions", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("submissions")
        .select(`
          *,
          assignments (
            id,
            title,
            due_date,
            points_possible,
            classrooms (
              id,
              name
            )
          )
        `)
        .eq("student_id", user.id)
        .order("submitted_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Create or update a submission (text-based)
  const submitAssignment = useMutation({
    mutationFn: async ({
      assignmentId,
      textContent,
      isLate,
    }: {
      assignmentId: string;
      textContent: string;
      isLate?: boolean;
    }) => {
      if (!user) throw new Error("Not authenticated");

      // Check if submission already exists
      const { data: existing } = await supabase
        .from("submissions")
        .select("id")
        .eq("assignment_id", assignmentId)
        .eq("student_id", user.id)
        .maybeSingle();

      if (existing) {
        // Update existing submission
        const { data, error } = await supabase
          .from("submissions")
          .update({
            text_content: textContent,
            submitted_at: new Date().toISOString(),
            status: "submitted",
          })
          .eq("id", existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Create new submission
        const { data, error } = await supabase
          .from("submissions")
          .insert({
            assignment_id: assignmentId,
            student_id: user.id,
            text_content: textContent,
            is_late: isLate || false,
            status: "submitted",
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["student-assignments"] });
      toast({
        title: "Assignment submitted!",
        description: "Your work has been submitted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Submission failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Submit with file upload
  const submitWithFile = useMutation({
    mutationFn: async ({
      assignmentId,
      file,
      isLate,
    }: {
      assignmentId: string;
      file: File;
      isLate?: boolean;
    }) => {
      if (!user) throw new Error("Not authenticated");

      // Upload file to submissions bucket
      const filePath = `${user.id}/${assignmentId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("submissions")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Check if submission already exists
      const { data: existing } = await supabase
        .from("submissions")
        .select("id")
        .eq("assignment_id", assignmentId)
        .eq("student_id", user.id)
        .maybeSingle();

      if (existing) {
        // Update existing submission
        const { data, error } = await supabase
          .from("submissions")
          .update({
            file_path: filePath,
            file_name: file.name,
            submitted_at: new Date().toISOString(),
            status: "submitted",
          })
          .eq("id", existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Create new submission
        const { data, error } = await supabase
          .from("submissions")
          .insert({
            assignment_id: assignmentId,
            student_id: user.id,
            file_path: filePath,
            file_name: file.name,
            is_late: isLate || false,
            status: "submitted",
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["student-assignments"] });
      toast({
        title: "File submitted!",
        description: "Your file has been uploaded successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    submissions,
    isLoading,
    error,
    submitAssignment,
    submitWithFile,
  };
};

// Hook for getting a single submission
export const useSubmission = (assignmentId: string | null) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["submission", assignmentId, user?.id],
    queryFn: async () => {
      if (!assignmentId || !user) return null;

      const { data, error } = await supabase
        .from("submissions")
        .select("*")
        .eq("assignment_id", assignmentId)
        .eq("student_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!assignmentId && !!user,
  });
};
