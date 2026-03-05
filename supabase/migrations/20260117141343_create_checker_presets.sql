-- Create checker_presets table for storing grading configurations
CREATE TABLE IF NOT EXISTS public.checker_presets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  instructions TEXT NOT NULL,
  rubric_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_points INTEGER NOT NULL DEFAULT 100,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for teacher_id for faster queries
CREATE INDEX IF NOT EXISTS idx_checker_presets_teacher_id ON public.checker_presets(teacher_id);

-- Create index for created_at for ordering
CREATE INDEX IF NOT EXISTS idx_checker_presets_created_at ON public.checker_presets(created_at DESC);

-- Row Level Security (RLS) policies
ALTER TABLE public.checker_presets ENABLE ROW LEVEL SECURITY;

-- Only teachers can view their own presets
CREATE POLICY "Teachers can view own checker presets" ON public.checker_presets
  FOR SELECT USING (auth.uid() = teacher_id);

-- Only teachers can insert their own presets
CREATE POLICY "Teachers can insert own checker presets" ON public.checker_presets
  FOR INSERT WITH CHECK (auth.uid() = teacher_id);

-- Only teachers can update their own presets
CREATE POLICY "Teachers can update own checker presets" ON public.checker_presets
  FOR UPDATE USING (auth.uid() = teacher_id);

-- Only teachers can delete their own presets
CREATE POLICY "Teachers can delete own checker presets" ON public.checker_presets
  FOR DELETE USING (auth.uid() = teacher_id);
