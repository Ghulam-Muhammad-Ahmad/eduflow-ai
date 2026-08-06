import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type OneToOneRoomRow = {
  id: string;
  workspace_id: string;
  tutor_id: string;
  student_id: string;
  name: string | null;
  created_at: string;
  updated_at: string;
  /**
   * `email` is optional because it is only ever populated for owner-scoped queries
   * (see useOwnerWorkspace). Teacher and student views deliberately omit it.
   */
  tutorProfile?: { display_name: string | null; email?: string | null; avatar_url?: string | null } | null;
  studentProfile?: { display_name: string | null; email?: string | null; avatar_url?: string | null } | null;
};

/**
 * 1v1 rooms for the current user: as tutor (teacher) returns rooms where tutor_id = me; as student returns rooms where student_id = me.
 */
export function useOneToOneRooms() {
  const { user, role } = useAuth();

  const { data: rooms = [], isLoading, error } = useQuery({
    queryKey: ["one-to-one-rooms", user?.id, role],
    queryFn: async (): Promise<OneToOneRoomRow[]> => {
      if (!user?.id) return [];
      if (role === "teacher") {
        const { data: rows, error: e } = await supabase
          .from("one_to_one_rooms")
          .select("id, workspace_id, tutor_id, student_id, name, created_at, updated_at")
          .eq("tutor_id", user.id)
          .order("created_at", { ascending: false });
        if (e) throw e;
        if (!rows?.length) return [];
        const studentIds = [...new Set(rows.map((r) => r.student_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name, avatar_url")
          .in("user_id", studentIds);
        const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
        return rows.map((r) => ({
          ...r,
          studentProfile: profileMap.get(r.student_id) ?? null,
        }));
      }
      if (role === "student") {
        const { data: rows, error: e } = await supabase
          .from("one_to_one_rooms")
          .select("id, workspace_id, tutor_id, student_id, name, created_at, updated_at")
          .eq("student_id", user.id)
          .order("created_at", { ascending: false });
        if (e) throw e;
        if (!rows?.length) return [];
        const tutorIds = [...new Set(rows.map((r) => r.tutor_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name, avatar_url")
          .in("user_id", tutorIds);
        const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
        return rows.map((r) => ({
          ...r,
          tutorProfile: profileMap.get(r.tutor_id) ?? null,
        }));
      }
      return [];
    },
    enabled: !!user && (role === "teacher" || role === "student"),
  });

  return {
    oneToOneRooms: rooms,
    isLoading,
    error,
  };
}
