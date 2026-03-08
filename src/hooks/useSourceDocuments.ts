import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";
import { getStorageLimitExceededMessage } from "@/lib/storage-quota";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface SourceDocument {
  id: string;
  teacher_id: string;
  title: string;
  description: string | null;
  file_path: string;
  file_type: string;
  file_size: number;
  document_type: "rubric" | "answer_key" | "example_paper" | "reference";
  created_at: string;
  updated_at: string;
}

/** Input for creating a source document: same as DB but with file instead of file_path/file_type/file_size */
export type CreateSourceDocumentInput = Omit<SourceDocument, "id" | "created_at" | "updated_at" | "file_path" | "file_type" | "file_size" | "teacher_id"> & {
  file: File;
};

export const useSourceDocuments = () => {
  return useQuery({
    queryKey: ["source-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("source_documents")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as SourceDocument[];
    },
  });
};

export const useCreateSourceDocument = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (doc: CreateSourceDocumentInput) => {
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

      if ((storage.limitBytes ?? 0) <= 0 || (storage.usedBytes ?? 0) + doc.file.size > (storage.limitBytes ?? 0)) {
        throw new Error(
          (storage.limitBytes ?? 0) <= 0
            ? "No storage allocated yet. Ask the workspace owner to assign document storage first."
            : getStorageLimitExceededMessage(storage.remainingBytes ?? 0, doc.file.size)
        );
      }

      // First upload file to storage
      const fileExtension = doc.file.name.split('.').pop();
      const fileName = `source-docs/${Date.now()}.${fileExtension}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("documents")
        .upload(fileName, doc.file, {
          contentType: doc.file.type,
        });

      if (uploadError) throw uploadError;

      // Then create database record
      const { data, error } = await supabase
        .from("source_documents")
        .insert({
          ...doc,
          file_path: uploadData.path,
          file_type: doc.file.type,
          file_size: doc.file.size,
        })
        .select()
        .single();

      if (error) throw error;
      return data as SourceDocument;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["source-documents"] });
    },
  });
};

export const useDeleteSourceDocument = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      // Get file path first
      const { data: doc } = await supabase
        .from("source_documents")
        .select("file_path")
        .eq("id", id)
        .single();

      if (doc?.file_path) {
        // Delete from storage
        await supabase.storage.from("documents").remove([doc.file_path]);
      }

      // Delete from database
      const { error } = await supabase
        .from("source_documents")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["source-documents"] });
    },
  });
};
