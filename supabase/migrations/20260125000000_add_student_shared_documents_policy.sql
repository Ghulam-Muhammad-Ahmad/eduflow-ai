-- Add policy for students to view documents shared with their enrolled classrooms

CREATE POLICY "Students can view shared documents"
ON public.documents FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM public.document_classroom_shares
    JOIN public.enrollments ON enrollments.classroom_id = document_classroom_shares.classroom_id
    WHERE document_classroom_shares.document_id = documents.id
      AND enrollments.student_id = auth.uid()
      AND enrollments.status = 'active'
  )
);
