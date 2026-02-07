import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface CheckerPreset {
  id: string;
  teacher_id: string;
  name: string;
  description: string | null;
  instructions: string;
  rubric_categories: {
    name: string;
    max_points: number;
    description: string | null;
  }[];
  total_points: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export const useCheckerPresets = () => {
  return useQuery({
    queryKey: ["checker-presets"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("checker_presets")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          // Table doesn't exist yet, return empty array
          if (error.code === 'PGRST116') {
            return [];
          }
          throw error;
        }
        return data as CheckerPreset[];
      } catch (err) {
        // If table doesn't exist, return empty array
        console.log("Checker presets table not found, using empty array");
        return [];
      }
    },
  });
};

export const useCreateCheckerPreset = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (preset: Omit<CheckerPreset, "id" | "created_at" | "updated_at">) => {
      try {
        const { data, error } = await supabase
          .from("checker_presets")
          .insert(preset)
          .select()
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            throw new Error("Checker presets table not found. Please create the database table first.");
          }
          throw error;
        }
        return data as CheckerPreset;
      } catch (err) {
        throw new Error("Failed to create preset. Table may not exist.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checker-presets"] });
    },
  });
};

export const useUpdateCheckerPreset = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...preset }: Partial<CheckerPreset> & { id: string }) => {
      try {
        const { data, error } = await supabase
          .from("checker_presets")
          .update(preset)
          .eq("id", id)
          .select()
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            throw new Error("Checker presets table not found. Please create the database table first.");
          }
          throw error;
        }
        return data as CheckerPreset;
      } catch (err) {
        throw new Error("Failed to update preset. Table may not exist.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checker-presets"] });
    },
  });
};

export const useDeleteCheckerPreset = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      try {
        // Get file path first
        const { data: doc } = await supabase
          .from("checker_presets")
          .select("title")
          .eq("id", id)
          .single();

        if (doc?.title) {
          // Delete from storage if needed (future enhancement)
        }

        // Delete from database
        const { error } = await supabase
          .from("checker_presets")
          .delete()
          .eq("id", id);

        if (error) {
          if (error.code === 'PGRST116') {
            throw new Error("Checker presets table not found. Please create the database table first.");
          }
          throw error;
        }
      } catch (err) {
        throw new Error("Failed to delete preset. Table may not exist.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checker-presets"] });
    },
  });
};
