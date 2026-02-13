import { useQuery } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";
import { useAuth } from "@/hooks/useAuth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface TeacherDocument {
  id: string;
  name: string;
  file_path: string;
  file_type: string;
}

export const useTeacherDocuments = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["teacher-documents", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("documents")
        .select("id, name, file_path, file_type")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as TeacherDocument[];
    },
    enabled: !!user?.id,
  });
};
