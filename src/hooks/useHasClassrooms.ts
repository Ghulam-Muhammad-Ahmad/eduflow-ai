import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * For students: returns whether the current user has at least one active classroom enrollment.
 * Used to switch between Classroom Student nav and Self-Study nav.
 */
export function useHasClassrooms(): { hasClassrooms: boolean; isLoading: boolean } {
  const { user, role } = useAuth();
  const { data: enrollments, isLoading } = useQuery({
    queryKey: ["student-enrollments-count", user?.id],
    queryFn: async () => {
      if (!user?.id || role !== "student") return [];
      const { data, error } = await supabase
        .from("enrollments")
        .select("classroom_id")
        .eq("student_id", user.id)
        .eq("status", "active");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user && role === "student",
  });
  return {
    hasClassrooms: (enrollments?.length ?? 0) > 0,
    isLoading,
  };
}
