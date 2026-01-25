-- Add storage policy for students to download documents shared with their enrolled classrooms
-- This allows students to download files from the documents bucket even if they're in a teacher's folder

-- Create a function to check if a storage object (file) is accessible to a student
-- This checks if the file_path corresponds to a document shared with the student's classrooms
CREATE OR REPLACE FUNCTION public.is_storage_object_shared_with_student(p_file_path TEXT, p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.documents d
    JOIN public.document_classroom_shares dcs ON dcs.document_id = d.id
    JOIN public.enrollments e ON e.classroom_id = dcs.classroom_id
    WHERE d.file_path = p_file_path
      AND e.student_id = p_student_id
      AND e.status = 'active'
  );
END;
$$;

-- Add storage policy for students to download shared documents
CREATE POLICY "Students can download shared documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents' AND
  public.is_storage_object_shared_with_student(name, auth.uid())
);
