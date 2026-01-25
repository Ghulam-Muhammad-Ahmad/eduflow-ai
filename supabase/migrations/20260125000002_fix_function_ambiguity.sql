-- Drop the policy first to avoid dependency errors
DROP POLICY IF EXISTS "Students can view shared documents" ON public.documents;

-- Drop the existing function to fix ambiguous column reference
DROP FUNCTION IF EXISTS public.is_document_shared_with_student(UUID, UUID);

-- Recreate with properly named parameters to avoid ambiguity
CREATE OR REPLACE FUNCTION public.is_document_shared_with_student(p_doc_id UUID, p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.document_classroom_shares dcs
    JOIN public.enrollments e ON e.classroom_id = dcs.classroom_id
    WHERE dcs.document_id = p_doc_id
      AND e.student_id = p_student_id
      AND e.status = 'active'
  );
END;
$$;

-- Recreate the policy to use the new function signature
CREATE POLICY "Students can view shared documents"
ON public.documents FOR SELECT
USING (
  public.is_document_shared_with_student(id, auth.uid())
);
