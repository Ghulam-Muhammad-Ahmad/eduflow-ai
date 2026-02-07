import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";

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
    mutationFn: async (doc: Omit<SourceDocument, "id" | "created_at" | "updated_at">) => {
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
