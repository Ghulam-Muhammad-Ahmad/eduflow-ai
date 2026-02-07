-- Create source_documents table for storing rubrics, answer keys, and reference materials
CREATE TABLE IF NOT EXISTS public.source_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('rubric', 'answer_key', 'example_paper', 'reference')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for teacher_id for faster queries
CREATE INDEX IF NOT EXISTS idx_source_documents_teacher_id ON public.source_documents(teacher_id);

-- Create index for created_at for ordering
CREATE INDEX IF NOT EXISTS idx_source_documents_created_at ON public.source_documents(created_at DESC);

-- Create index for document_type for filtering
CREATE INDEX IF NOT EXISTS idx_source_documents_document_type ON public.source_documents(document_type);

-- Row Level Security (RLS) policies
ALTER TABLE public.source_documents ENABLE ROW LEVEL SECURITY;

-- Only teachers can view their own source documents
CREATE POLICY "Teachers can view own source documents" ON public.source_documents
  FOR SELECT USING (auth.uid() = teacher_id);

-- Only teachers can insert their own source documents
CREATE POLICY "Teachers can insert own source documents" ON public.source_documents
  FOR INSERT WITH CHECK (auth.uid() = teacher_id);

-- Only teachers can update their own source documents
CREATE POLICY "Teachers can update own source documents" ON public.source_documents
  FOR UPDATE USING (auth.uid() = teacher_id);

-- Only teachers can delete their own source documents
CREATE POLICY "Teachers can delete own source documents" ON public.source_documents
  FOR DELETE USING (auth.uid() = teacher_id);
