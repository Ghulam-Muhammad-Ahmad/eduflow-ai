import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * For students: whether the current user has at least one active classroom enrollment
 * OR at least one 1v1 room. Used to decide between the "waiting to be added" empty state
 * and the real dashboard/sidebar.
 */
export function useStudentHasContent(): { hasContent: boolean; isLoading: boolean } {
  const { user, role } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["student-has-content", user?.id],
    queryFn: async () => {
      if (!user?.id || role !== "student") return { classrooms: 0, rooms: 0 };
      const [{ data: enrollments, error: e1 }, { data: rooms, error: e2 }] = await Promise.all([
        supabase
          .from("enrollments")
          .select("classroom_id")
          .eq("student_id", user.id)
          .eq("status", "active"),
        supabase.from("one_to_one_rooms").select("id").eq("student_id", user.id),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      return { classrooms: enrollments?.length ?? 0, rooms: rooms?.length ?? 0 };
    },
    enabled: !!user && role === "student",
  });
  return {
    hasContent: (data?.classrooms ?? 0) > 0 || (data?.rooms ?? 0) > 0,
    isLoading,
  };
}
