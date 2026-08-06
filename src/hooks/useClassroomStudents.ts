import { useQuery } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const useClassroomStudents = (classroomId: string | null) => {
  return useQuery({
    queryKey: ["classroom-students", classroomId],
    queryFn: async () => {
      if (!classroomId) return [];

      // Names only — teachers must not see student contact details.
      const { data, error } = await supabase
        .from("enrollments")
        .select(
          `
          student_id,
          profiles (
            id,
            display_name
          )
        `
        )
        .eq("classroom_id", classroomId)
        .eq("status", "active");

      if (error) throw error;

      return data.map(enrollment => {
        const p = (enrollment as { profiles?: { display_name?: string | null } | { display_name?: string | null }[] }).profiles;
        const s = Array.isArray(p) ? p[0] : p;
        return {
          id: enrollment.student_id,
          display_name: s?.display_name ?? "Unknown Student",
        };
      });
    },
    enabled: !!classroomId,
  });
};
