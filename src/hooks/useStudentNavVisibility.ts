import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { resolveHiddenNavKeys } from "@/lib/studentNav";

/**
 * Resolves which student sidebar items are hidden for the current student: their own
 * per-student override (workspace_students.settings.nav_hidden) if set, otherwise the
 * workspace-wide default (workspaces.settings.student_nav_hidden).
 *
 * A student's `workspace_students` PK is (workspace_id, student_id), so in principle a
 * student could belong to more than one workspace. This picks the earliest-created
 * membership as "primary" — the product model (one tutoring center per student
 * relationship) makes multi-workspace students unlikely, but this is the spot to revisit
 * if that assumption ever breaks.
 */
export function useStudentNavVisibility() {
  const { user, role } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["student-nav-visibility", user?.id],
    queryFn: async () => {
      if (!user?.id || role !== "student") {
        return { workspaceDefault: [] as string[], studentOverride: null as string[] | null };
      }

      const { data: ws, error: e1 } = await supabase
        .from("workspace_students")
        .select("workspace_id, settings, created_at")
        .eq("student_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (e1) throw e1;
      if (!ws) return { workspaceDefault: [] as string[], studentOverride: null as string[] | null };

      const studentOverride =
        (ws.settings as { nav_hidden?: string[] } | null)?.nav_hidden ?? null;

      const { data: workspace, error: e2 } = await supabase
        .from("workspaces")
        .select("settings")
        .eq("id", ws.workspace_id)
        .maybeSingle();
      if (e2) throw e2;

      const workspaceDefault =
        (workspace?.settings as { student_nav_hidden?: string[] } | null)?.student_nav_hidden ?? [];

      return { workspaceDefault, studentOverride };
    },
    enabled: !!user && role === "student",
  });

  return {
    hiddenKeys: resolveHiddenNavKeys(data?.workspaceDefault, data?.studentOverride),
    isLoading,
  };
}
