import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getStorageLimitExceededMessage } from "@/lib/storage-quota";

export interface DocCenterDocument {
  id: string;
  name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocCenterFolder {
  id: string;
  name: string;
  parent_id: string | null;
}

/** Returns folders and documents for the current user (Doc Center / Smart Tutor picker). */
export function useDocCenterMini(enabled = true) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["doc-center-mini", user?.id],
    queryFn: async (): Promise<{ folders: DocCenterFolder[]; documents: DocCenterDocument[] }> => {
      if (!user?.id) return { folders: [], documents: [] };

      const [foldersRes, docsRes] = await Promise.all([
        supabase
          .from("folders")
          .select("id, name, parent_id")
          .eq("user_id", user.id)
          .order("name"),
        supabase
          .from("documents")
          .select("id, name, file_path, file_type, file_size, folder_id, created_at, updated_at")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false }),
      ]);

      if (foldersRes.error) throw foldersRes.error;
      if (docsRes.error) throw docsRes.error;

      return {
        folders: (foldersRes.data ?? []) as DocCenterFolder[],
        documents: (docsRes.data ?? []) as DocCenterDocument[],
      };
    },
    enabled: !!user?.id && enabled,
  });

  const uploadMutation = useMutation({
    mutationFn: async ({
      file,
      folderId = null,
    }: {
      file: File;
      folderId?: string | null;
    }) => {
      if (!user?.id) throw new Error("Not authenticated");

      const storageRes = await fetch("/api/storage/context", { credentials: "include" });
      if (!storageRes.ok) {
        const json = await storageRes.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? "Failed to check storage");
      }

      const storage = (await storageRes.json()) as {
        limitBytes: number;
        usedBytes: number;
        remainingBytes: number;
      };

      if ((storage.limitBytes ?? 0) <= 0 || (storage.usedBytes ?? 0) + file.size > (storage.limitBytes ?? 0)) {
        throw new Error(
          (storage.limitBytes ?? 0) <= 0
            ? "No storage allocated yet. Ask the workspace owner to assign document storage first."
            : getStorageLimitExceededMessage(storage.remainingBytes ?? 0, file.size)
        );
      }

      const fileName = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(fileName, file, { contentType: file.type });

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("documents").insert({
        user_id: user.id,
        folder_id: folderId,
        name: file.name,
        file_path: fileName,
        file_size: file.size,
        file_type: file.type || "application/octet-stream",
      });

      if (insertError) throw insertError;
      return { file, filePath: fileName };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doc-center-mini", user?.id] });
    },
  });

  return {
    folders: query.data?.folders ?? [],
    documents: query.data?.documents ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    upload: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
  };
}
