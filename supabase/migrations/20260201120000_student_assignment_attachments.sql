-- Allow students to view and download documents attached to assignments they can access
-- (in addition to documents shared to their classroom)

-- 1. Students can SELECT documents that are attached to a published assignment in their enrolled classroom
CREATE POLICY "Students can view documents attached to assignments"
ON public.documents FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.assignment_attachments aa
    JOIN public.assignments a ON a.id = aa.assignment_id
    JOIN public.enrollments e ON e.classroom_id = a.classroom_id
    WHERE aa.document_id = documents.id
      AND a.status = 'published'
      AND e.student_id = auth.uid()
      AND e.status = 'active'
  )
);

-- 2. Students can download storage objects for documents attached to their assignments
CREATE OR REPLACE FUNCTION public.is_storage_object_attached_to_assignment(p_file_path TEXT, p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.documents d
    JOIN public.assignment_attachments aa ON aa.document_id = d.id
    JOIN public.assignments a ON a.id = aa.assignment_id
    JOIN public.enrollments e ON e.classroom_id = a.classroom_id
    WHERE d.file_path = p_file_path
      AND a.status = 'published'
      AND e.student_id = p_student_id
      AND e.status = 'active'
  );
END;
$$;

CREATE POLICY "Students can download assignment attachment documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents'
  AND public.is_storage_object_attached_to_assignment(name, auth.uid())
);
