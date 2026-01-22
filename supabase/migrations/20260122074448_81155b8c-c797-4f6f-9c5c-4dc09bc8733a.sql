-- ===========================================
-- PHASE 1 P0: CLASSROOM & ASSIGNMENTS SCHEMA (Fixed Order)
-- ===========================================

-- 1. CLASSROOMS TABLE (without student policy)
CREATE TABLE public.classrooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  subject TEXT,
  join_code TEXT NOT NULL UNIQUE,
  settings JSONB DEFAULT '{"allow_late_submissions": true}'::jsonb,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on classrooms
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;

-- Teachers can view their own classrooms
CREATE POLICY "Teachers can view their own classrooms"
ON public.classrooms FOR SELECT
USING (teacher_id = auth.uid());

-- Teachers can create classrooms
CREATE POLICY "Teachers can create classrooms"
ON public.classrooms FOR INSERT
WITH CHECK (teacher_id = auth.uid());

-- Teachers can update their own classrooms
CREATE POLICY "Teachers can update their own classrooms"
ON public.classrooms FOR UPDATE
USING (teacher_id = auth.uid())
WITH CHECK (teacher_id = auth.uid());

-- Teachers can delete their own classrooms
CREATE POLICY "Teachers can delete their own classrooms"
ON public.classrooms FOR DELETE
USING (teacher_id = auth.uid());

-- 2. ENROLLMENTS TABLE
CREATE TABLE public.enrollments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'left', 'removed')),
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  left_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(classroom_id, student_id)
);

-- Enable RLS on enrollments
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- Students can view their own enrollments
CREATE POLICY "Students can view their own enrollments"
ON public.enrollments FOR SELECT
USING (student_id = auth.uid());

-- Students can create enrollments (join classroom)
CREATE POLICY "Students can join classrooms"
ON public.enrollments FOR INSERT
WITH CHECK (student_id = auth.uid());

-- Students can update their own enrollment (leave classroom)
CREATE POLICY "Students can leave classrooms"
ON public.enrollments FOR UPDATE
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

-- Teachers can view enrollments for their classrooms
CREATE POLICY "Teachers can view enrollments in their classrooms"
ON public.enrollments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.classrooms
    WHERE classrooms.id = enrollments.classroom_id
    AND classrooms.teacher_id = auth.uid()
  )
);

-- Teachers can update enrollments (remove students)
CREATE POLICY "Teachers can update enrollments in their classrooms"
ON public.enrollments FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.classrooms
    WHERE classrooms.id = enrollments.classroom_id
    AND classrooms.teacher_id = auth.uid()
  )
);

-- 3. NOW add student policy for classrooms (enrollments exists now)
CREATE POLICY "Students can view enrolled classrooms"
ON public.classrooms FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE enrollments.classroom_id = classrooms.id
    AND enrollments.student_id = auth.uid()
    AND enrollments.status = 'active'
  )
);

-- 4. DOCUMENT CLASSROOM SHARES TABLE
CREATE TABLE public.document_classroom_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  shared_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(document_id, classroom_id)
);

-- Enable RLS on document_classroom_shares
ALTER TABLE public.document_classroom_shares ENABLE ROW LEVEL SECURITY;

-- Teachers can view shares for their documents
CREATE POLICY "Teachers can view their document shares"
ON public.document_classroom_shares FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.documents
    WHERE documents.id = document_classroom_shares.document_id
    AND documents.user_id = auth.uid()
  )
);

-- Teachers can create shares for their documents
CREATE POLICY "Teachers can share their documents"
ON public.document_classroom_shares FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.documents
    WHERE documents.id = document_classroom_shares.document_id
    AND documents.user_id = auth.uid()
  )
);

-- Teachers can delete shares for their documents
CREATE POLICY "Teachers can unshare their documents"
ON public.document_classroom_shares FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.documents
    WHERE documents.id = document_classroom_shares.document_id
    AND documents.user_id = auth.uid()
  )
);

-- Students can view shares for classrooms they are enrolled in
CREATE POLICY "Students can view shared documents"
ON public.document_classroom_shares FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE enrollments.classroom_id = document_classroom_shares.classroom_id
    AND enrollments.student_id = auth.uid()
    AND enrollments.status = 'active'
  )
);

-- 5. ASSIGNMENTS TABLE
CREATE TABLE public.assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  instructions TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  points_possible INTEGER DEFAULT 100,
  allow_late_submission BOOLEAN DEFAULT true,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed', 'graded')),
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on assignments
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- Teachers can view their own assignments
CREATE POLICY "Teachers can view their own assignments"
ON public.assignments FOR SELECT
USING (teacher_id = auth.uid());

-- Teachers can create assignments
CREATE POLICY "Teachers can create assignments"
ON public.assignments FOR INSERT
WITH CHECK (teacher_id = auth.uid());

-- Teachers can update their own assignments
CREATE POLICY "Teachers can update their own assignments"
ON public.assignments FOR UPDATE
USING (teacher_id = auth.uid())
WITH CHECK (teacher_id = auth.uid());

-- Teachers can delete their own assignments
CREATE POLICY "Teachers can delete their own assignments"
ON public.assignments FOR DELETE
USING (teacher_id = auth.uid());

-- Students can view published assignments in their enrolled classrooms
CREATE POLICY "Students can view published assignments"
ON public.assignments FOR SELECT
USING (
  status = 'published' AND
  EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE enrollments.classroom_id = assignments.classroom_id
    AND enrollments.student_id = auth.uid()
    AND enrollments.status = 'active'
  )
);

-- 6. ASSIGNMENT ATTACHMENTS TABLE
CREATE TABLE public.assignment_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, document_id)
);

-- Enable RLS on assignment_attachments
ALTER TABLE public.assignment_attachments ENABLE ROW LEVEL SECURITY;

-- Teachers can manage attachments for their assignments
CREATE POLICY "Teachers can view their assignment attachments"
ON public.assignment_attachments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.assignments
    WHERE assignments.id = assignment_attachments.assignment_id
    AND assignments.teacher_id = auth.uid()
  )
);

CREATE POLICY "Teachers can add attachments to their assignments"
ON public.assignment_attachments FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.assignments
    WHERE assignments.id = assignment_attachments.assignment_id
    AND assignments.teacher_id = auth.uid()
  )
);

CREATE POLICY "Teachers can remove attachments from their assignments"
ON public.assignment_attachments FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.assignments
    WHERE assignments.id = assignment_attachments.assignment_id
    AND assignments.teacher_id = auth.uid()
  )
);

-- Students can view attachments for published assignments they can access
CREATE POLICY "Students can view assignment attachments"
ON public.assignment_attachments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.assignments a
    JOIN public.enrollments e ON e.classroom_id = a.classroom_id
    WHERE a.id = assignment_attachments.assignment_id
    AND a.status = 'published'
    AND e.student_id = auth.uid()
    AND e.status = 'active'
  )
);

-- 7. SUBMISSIONS TABLE
CREATE TABLE public.submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path TEXT,
  file_name TEXT,
  text_content TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_late BOOLEAN DEFAULT false,
  grade DECIMAL(5,2),
  feedback TEXT,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'graded', 'returned')),
  graded_at TIMESTAMP WITH TIME ZONE,
  returned_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, student_id)
);

-- Enable RLS on submissions
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- Students can view their own submissions
CREATE POLICY "Students can view their own submissions"
ON public.submissions FOR SELECT
USING (student_id = auth.uid());

-- Students can create submissions for assignments they can access
CREATE POLICY "Students can submit assignments"
ON public.submissions FOR INSERT
WITH CHECK (
  student_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.assignments a
    JOIN public.enrollments e ON e.classroom_id = a.classroom_id
    WHERE a.id = submissions.assignment_id
    AND a.status = 'published'
    AND e.student_id = auth.uid()
    AND e.status = 'active'
  )
);

-- Students can update their own submissions (resubmit)
CREATE POLICY "Students can update their own submissions"
ON public.submissions FOR UPDATE
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

-- Teachers can view submissions for their assignments
CREATE POLICY "Teachers can view submissions for their assignments"
ON public.submissions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.assignments
    WHERE assignments.id = submissions.assignment_id
    AND assignments.teacher_id = auth.uid()
  )
);

-- Teachers can update submissions (grade)
CREATE POLICY "Teachers can grade submissions"
ON public.submissions FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.assignments
    WHERE assignments.id = submissions.assignment_id
    AND assignments.teacher_id = auth.uid()
  )
);

-- 8. Create storage bucket for submissions
INSERT INTO storage.buckets (id, name, public)
VALUES ('submissions', 'submissions', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for submissions bucket
CREATE POLICY "Students can upload submissions"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'submissions' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Students can view their own file submissions"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'submissions' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Teachers can view student file submissions"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'submissions' AND
  EXISTS (
    SELECT 1 FROM public.submissions s
    JOIN public.assignments a ON a.id = s.assignment_id
    WHERE s.file_path = name
    AND a.teacher_id = auth.uid()
  )
);

-- 9. Create function to generate unique join codes
CREATE OR REPLACE FUNCTION public.generate_join_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code_exists BOOLEAN;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    
    SELECT EXISTS(SELECT 1 FROM public.classrooms WHERE join_code = code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN code;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 10. Create function to validate join code and get classroom info
CREATE OR REPLACE FUNCTION public.get_classroom_by_join_code(code TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  subject TEXT,
  teacher_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.description,
    c.subject,
    COALESCE(p.display_name, 'Teacher') as teacher_name
  FROM public.classrooms c
  LEFT JOIN public.profiles p ON p.user_id = c.teacher_id
  WHERE c.join_code = UPPER(code)
  AND c.is_archived = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 11. Update timestamps triggers for new tables
CREATE TRIGGER update_classrooms_updated_at
BEFORE UPDATE ON public.classrooms
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_assignments_updated_at
BEFORE UPDATE ON public.assignments
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_submissions_updated_at
BEFORE UPDATE ON public.submissions
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- 12. Create indexes for performance
CREATE INDEX idx_classrooms_teacher_id ON public.classrooms(teacher_id);
CREATE INDEX idx_classrooms_join_code ON public.classrooms(join_code);
CREATE INDEX idx_enrollments_student_id ON public.enrollments(student_id);
CREATE INDEX idx_enrollments_classroom_id ON public.enrollments(classroom_id);
CREATE INDEX idx_assignments_classroom_id ON public.assignments(classroom_id);
CREATE INDEX idx_assignments_teacher_id ON public.assignments(teacher_id);
CREATE INDEX idx_submissions_assignment_id ON public.submissions(assignment_id);
CREATE INDEX idx_submissions_student_id ON public.submissions(student_id);
CREATE INDEX idx_document_classroom_shares_document_id ON public.document_classroom_shares(document_id);
CREATE INDEX idx_document_classroom_shares_classroom_id ON public.document_classroom_shares(classroom_id);