-- Add one_to_one_room_id support to assignments and quizzes; document_one_to_one_room_shares; RLS and helper updates.

-- Helper: is the 1v1 room in a workspace owned by the given owner?
CREATE OR REPLACE FUNCTION public.is_one_to_one_room_in_owner_workspace(p_room_id uuid, p_owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.one_to_one_rooms o
    JOIN public.workspaces w ON w.id = o.workspace_id
    WHERE o.id = p_room_id AND w.owner_id = p_owner_id
  );
$$;

-- Assignments: add one_to_one_room_id, make classroom_id nullable, enforce exactly one of the two
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS one_to_one_room_id uuid REFERENCES public.one_to_one_rooms(id) ON DELETE CASCADE;

ALTER TABLE public.assignments
  ALTER COLUMN classroom_id DROP NOT NULL;

ALTER TABLE public.assignments
  DROP CONSTRAINT IF EXISTS assignments_classroom_or_room_check;

ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_classroom_or_room_check CHECK (
    (classroom_id IS NOT NULL AND one_to_one_room_id IS NULL)
    OR (classroom_id IS NULL AND one_to_one_room_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_assignments_one_to_one_room_id ON public.assignments (one_to_one_room_id);

-- Quizzes: same
ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS one_to_one_room_id uuid REFERENCES public.one_to_one_rooms(id) ON DELETE CASCADE;

ALTER TABLE public.quizzes
  ALTER COLUMN classroom_id DROP NOT NULL;

ALTER TABLE public.quizzes
  DROP CONSTRAINT IF EXISTS quizzes_classroom_or_room_check;

ALTER TABLE public.quizzes
  ADD CONSTRAINT quizzes_classroom_or_room_check CHECK (
    (classroom_id IS NOT NULL AND one_to_one_room_id IS NULL)
    OR (classroom_id IS NULL AND one_to_one_room_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_quizzes_one_to_one_room_id ON public.quizzes (one_to_one_room_id);

-- Document shares for 1v1 rooms
CREATE TABLE IF NOT EXISTS public.document_one_to_one_room_shares (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  one_to_one_room_id uuid NOT NULL REFERENCES public.one_to_one_rooms(id) ON DELETE CASCADE,
  shared_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (document_id, one_to_one_room_id)
);

CREATE INDEX IF NOT EXISTS idx_document_one_to_one_room_shares_document_id ON public.document_one_to_one_room_shares (document_id);
CREATE INDEX IF NOT EXISTS idx_document_one_to_one_room_shares_room_id ON public.document_one_to_one_room_shares (one_to_one_room_id);

ALTER TABLE public.document_one_to_one_room_shares ENABLE ROW LEVEL SECURITY;

-- Teachers can manage document_one_to_one_room_shares for docs they own and rooms they tutor
CREATE POLICY "Teachers can insert document_one_to_one_room_shares"
  ON public.document_one_to_one_room_shares FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_id AND d.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.one_to_one_rooms o WHERE o.id = one_to_one_room_id AND o.tutor_id = auth.uid())
  );

CREATE POLICY "Teachers can delete document_one_to_one_room_shares"
  ON public.document_one_to_one_room_shares FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_id AND d.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.one_to_one_rooms o WHERE o.id = one_to_one_room_id AND o.tutor_id = auth.uid())
  );

CREATE POLICY "Teachers and students can view document_one_to_one_room_shares for their rooms"
  ON public.document_one_to_one_room_shares FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.one_to_one_rooms o WHERE o.id = one_to_one_room_id AND (o.tutor_id = auth.uid() OR o.student_id = auth.uid()))
  );

GRANT ALL ON TABLE public.document_one_to_one_room_shares TO anon;
GRANT ALL ON TABLE public.document_one_to_one_room_shares TO authenticated;
GRANT ALL ON TABLE public.document_one_to_one_room_shares TO service_role;

-- Update is_document_shared_with_student: include 1v1 room shares
CREATE OR REPLACE FUNCTION public.is_document_shared_with_student(p_doc_id uuid, p_student_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.document_classroom_shares dcs
    JOIN public.enrollments e ON e.classroom_id = dcs.classroom_id
    WHERE dcs.document_id = p_doc_id
      AND e.student_id = p_student_id
      AND e.status = 'active'
  )
  OR EXISTS (
    SELECT 1
    FROM public.document_one_to_one_room_shares dos
    JOIN public.one_to_one_rooms o ON o.id = dos.one_to_one_room_id
    WHERE dos.document_id = p_doc_id
      AND o.student_id = p_student_id
  );
END;
$$;

-- Update is_storage_object_shared_with_student: include 1v1 room shares
CREATE OR REPLACE FUNCTION public.is_storage_object_shared_with_student(p_file_path text, p_student_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public
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
  )
  OR EXISTS (
    SELECT 1
    FROM public.documents d
    JOIN public.document_one_to_one_room_shares dos ON dos.document_id = d.id
    JOIN public.one_to_one_rooms o ON o.id = dos.one_to_one_room_id
    WHERE d.file_path = p_file_path
      AND o.student_id = p_student_id
  );
END;
$$;

-- Update is_storage_object_attached_to_assignment: allow 1v1 room assignment for that student
CREATE OR REPLACE FUNCTION public.is_storage_object_attached_to_assignment(p_file_path text, p_student_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public
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
  )
  OR EXISTS (
    SELECT 1
    FROM public.documents d
    JOIN public.assignment_attachments aa ON aa.document_id = d.id
    JOIN public.assignments a ON a.id = aa.assignment_id
    JOIN public.one_to_one_rooms o ON o.id = a.one_to_one_room_id
    WHERE d.file_path = p_file_path
      AND a.status = 'published'
      AND o.student_id = p_student_id
  );
END;
$$;

-- Update is_submission_in_owner_workspace: allow assignment in owner's 1v1 room
CREATE OR REPLACE FUNCTION public.is_submission_in_owner_workspace(p_assignment_id uuid, p_owner_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id = p_assignment_id
      AND (
        (a.classroom_id IS NOT NULL AND public.is_classroom_in_owner_workspace(a.classroom_id, p_owner_id))
        OR (a.one_to_one_room_id IS NOT NULL AND public.is_one_to_one_room_in_owner_workspace(a.one_to_one_room_id, p_owner_id))
      )
  );
$$;

-- RLS: Students can view published assignments (classroom enrollment OR 1v1 room membership)
DROP POLICY IF EXISTS "Students can view published assignments" ON public.assignments;
CREATE POLICY "Students can view published assignments"
  ON public.assignments FOR SELECT
  USING (
    status = 'published'
    AND (
      (classroom_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.enrollments e
        WHERE e.classroom_id = assignments.classroom_id
          AND e.student_id = auth.uid()
          AND e.status = 'active'
      ))
      OR (one_to_one_room_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.one_to_one_rooms o
        WHERE o.id = assignments.one_to_one_room_id AND o.student_id = auth.uid()
      ))
    )
  );

-- RLS: Students can submit to assignments (classroom OR 1v1)
DROP POLICY IF EXISTS "Students can submit assignments" ON public.submissions;
CREATE POLICY "Students can submit assignments"
  ON public.submissions FOR INSERT
  WITH CHECK (
    student_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.assignments a
        JOIN public.enrollments e ON e.classroom_id = a.classroom_id
        WHERE a.id = submissions.assignment_id
          AND a.status = 'published'
          AND e.student_id = auth.uid()
          AND e.status = 'active'
      )
      OR EXISTS (
        SELECT 1 FROM public.assignments a
        JOIN public.one_to_one_rooms o ON o.id = a.one_to_one_room_id
        WHERE a.id = submissions.assignment_id
          AND a.status = 'published'
          AND o.student_id = auth.uid()
      )
    )
  );

-- RLS: Students can view quizzes in enrolled classrooms or their 1v1 rooms
DROP POLICY IF EXISTS "Students can view quizzes in enrolled classrooms" ON public.quizzes;
CREATE POLICY "Students can view quizzes in enrolled classrooms"
  ON public.quizzes FOR SELECT
  USING (
    status IN ('scheduled', 'active', 'closed')
    AND (
      (classroom_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.enrollments e
        WHERE e.classroom_id = quizzes.classroom_id
          AND e.student_id = auth.uid()
          AND e.status = 'active'
      ))
      OR (one_to_one_room_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.one_to_one_rooms o
        WHERE o.id = quizzes.one_to_one_room_id AND o.student_id = auth.uid()
      ))
    )
  );

-- RLS: Owners can view assignments in their workspace (classroom or 1v1 room)
DROP POLICY IF EXISTS "Owners can view assignments in their workspace" ON public.assignments;
CREATE POLICY "Owners can view assignments in their workspace"
  ON public.assignments FOR SELECT
  USING (
    (classroom_id IS NOT NULL AND public.is_classroom_in_owner_workspace(classroom_id, auth.uid()))
    OR (one_to_one_room_id IS NOT NULL AND public.is_one_to_one_room_in_owner_workspace(one_to_one_room_id, auth.uid()))
  );

-- RLS: Owners can view quizzes in their workspace
DROP POLICY IF EXISTS "Owners can view quizzes in their workspace" ON public.quizzes;
CREATE POLICY "Owners can view quizzes in their workspace"
  ON public.quizzes FOR SELECT
  USING (
    (classroom_id IS NOT NULL AND public.is_classroom_in_owner_workspace(classroom_id, auth.uid()))
    OR (one_to_one_room_id IS NOT NULL AND public.is_one_to_one_room_in_owner_workspace(one_to_one_room_id, auth.uid()))
  );

-- RLS: Students can view documents attached to assignments (classroom or 1v1)
DROP POLICY IF EXISTS "Students can view documents attached to assignments" ON public.documents;
CREATE POLICY "Students can view documents attached to assignments"
  ON public.documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.assignment_attachments aa
      JOIN public.assignments a ON a.id = aa.assignment_id
      LEFT JOIN public.enrollments e ON e.classroom_id = a.classroom_id AND e.student_id = auth.uid() AND e.status = 'active'
      LEFT JOIN public.one_to_one_rooms o ON o.id = a.one_to_one_room_id AND o.student_id = auth.uid()
      WHERE aa.document_id = documents.id
        AND a.status = 'published'
        AND (e.student_id IS NOT NULL OR o.student_id IS NOT NULL)
    )
  );
