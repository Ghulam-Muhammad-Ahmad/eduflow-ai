import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

export interface StudentTutor {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  subjects: string[];
  classrooms: { id: string; name: string; subject: string | null }[];
  one_to_one_rooms: { id: string; name: string | null }[];
}

/**
 * Tutors the signed-in student works with. Served by /api/student/tutors, which joins
 * tutor_contracts for subjects and therefore has to run server-side with the admin client.
 */
export function useStudentTutors() {
  const { user, role } = useAuth();

  const query = useQuery({
    queryKey: ["student-tutors", user?.id],
    queryFn: async (): Promise<StudentTutor[]> => {
      const res = await fetch("/api/student/tutors", { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "Failed to load tutors");
      return ((json as { tutors?: StudentTutor[] }).tutors ?? []);
    },
    enabled: !!user && role === "student",
  });

  return {
    tutors: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}
