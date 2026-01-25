-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Students can view shared documents" ON public.documents;

-- Instead, we'll use a security definer function to avoid circular RLS checks
-- This function bypasses RLS to check if a document is shared with the student's classrooms
CREATE OR REPLACE FUNCTION public.is_document_shared_with_student(doc_id UUID, student_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.document_classroom_shares dcs
    JOIN public.enrollments e ON e.classroom_id = dcs.classroom_id
    WHERE dcs.document_id = doc_id
      AND e.student_id = student_id
      AND e.status = 'active'
  );
END;
$$;

-- Now create the policy using the function
CREATE POLICY "Students can view shared documents"
ON public.documents FOR SELECT
USING (
  public.is_document_shared_with_student(id, auth.uid())
);
