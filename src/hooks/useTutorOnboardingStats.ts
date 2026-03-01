import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Counts for tutor onboarding checklist: classrooms and assignments created by current user.
 */
export function useTutorOnboardingStats() {
  const { user, role } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["tutor-onboarding-stats", user?.id],
    queryFn: async () => {
      if (!user?.id || role !== "teacher") return { classroomsCount: 0, assignmentsCount: 0, enrollmentsCount: 0 };
      const { data: myClassrooms } = await supabase.from("classrooms").select("id").eq("teacher_id", user.id);
      const classroomIds = (myClassrooms ?? []).map((c) => c.id);
      let enrollmentsCount = 0;
      if (classroomIds.length > 0) {
        const { count } = await supabase
          .from("enrollments")
          .select("id", { count: "exact", head: true })
          .in("classroom_id", classroomIds);
        enrollmentsCount = count ?? 0;
      }
      const [classRes, assignRes] = await Promise.all([
        supabase.from("classrooms").select("id", { count: "exact", head: true }).eq("teacher_id", user.id),
        supabase.from("assignments").select("id", { count: "exact", head: true }).eq("teacher_id", user.id),
      ]);
      return {
        classroomsCount: classRes.count ?? 0,
        assignmentsCount: assignRes.count ?? 0,
        enrollmentsCount,
      };
    },
    enabled: !!user && role === "teacher",
  });

  return {
    classroomsCount: stats?.classroomsCount ?? 0,
    assignmentsCount: stats?.assignmentsCount ?? 0,
    enrollmentsCount: stats?.enrollmentsCount ?? 0,
    isLoading,
  };
}
