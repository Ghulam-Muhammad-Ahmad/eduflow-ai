-- Checked papers: store AI-checked papers for students (from Check Paper flow)
CREATE TABLE public.checked_papers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  student_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  grade NUMERIC(5,2),
  feedback_text TEXT,
  instructions_used TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_checked_papers_teacher ON public.checked_papers(teacher_id);
CREATE INDEX idx_checked_papers_classroom ON public.checked_papers(classroom_id);
CREATE INDEX idx_checked_papers_student ON public.checked_papers(student_id);

ALTER TABLE public.checked_papers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage own checked papers"
  ON public.checked_papers FOR ALL
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Students can view checked papers for them"
  ON public.checked_papers FOR SELECT
  USING (
    student_id = auth.uid()
    OR (student_id IS NULL AND EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.classroom_id = checked_papers.classroom_id
        AND e.student_id = auth.uid()
        AND e.status = 'active'
    ))
  );

-- Storage bucket for checked paper files (HTML/PDF)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES (
  'checked-papers',
  'checked-papers',
  false,
  5242880
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Teachers can upload checked papers"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'checked-papers'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Teachers can update own checked papers"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'checked-papers'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Teachers and students can read checked papers"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'checked-papers');
