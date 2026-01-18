-- Create folders table for organizing documents
CREATE TABLE public.folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tags table
CREATE TABLE public.tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'primary',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Create documents table
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  file_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create document_tags junction table
CREATE TABLE public.document_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(document_id, tag_id)
);

-- Enable RLS on all tables
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_tags ENABLE ROW LEVEL SECURITY;

-- Folders policies
CREATE POLICY "Users can view their own folders"
ON public.folders FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own folders"
ON public.folders FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own folders"
ON public.folders FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own folders"
ON public.folders FOR DELETE
USING (user_id = auth.uid());

-- Tags policies
CREATE POLICY "Users can view their own tags"
ON public.tags FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own tags"
ON public.tags FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own tags"
ON public.tags FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own tags"
ON public.tags FOR DELETE
USING (user_id = auth.uid());

-- Documents policies
CREATE POLICY "Users can view their own documents"
ON public.documents FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own documents"
ON public.documents FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own documents"
ON public.documents FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own documents"
ON public.documents FOR DELETE
USING (user_id = auth.uid());

-- Document tags policies
CREATE POLICY "Users can view their document tags"
ON public.document_tags FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.documents WHERE documents.id = document_tags.document_id AND documents.user_id = auth.uid()
));

CREATE POLICY "Users can create document tags"
ON public.document_tags FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.documents WHERE documents.id = document_tags.document_id AND documents.user_id = auth.uid()
));

CREATE POLICY "Users can delete document tags"
ON public.document_tags FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.documents WHERE documents.id = document_tags.document_id AND documents.user_id = auth.uid()
));

-- Add triggers for updated_at
CREATE TRIGGER update_folders_updated_at
BEFORE UPDATE ON public.folders
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_documents_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('documents', 'documents', false, 10485760);

-- Storage policies for documents bucket
CREATE POLICY "Users can upload their own documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own documents"
ON storage.objects FOR UPDATE
USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);