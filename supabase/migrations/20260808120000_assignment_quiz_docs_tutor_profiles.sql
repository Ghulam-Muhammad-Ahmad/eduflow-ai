-- Bug fixes:
--   1. Students could not see documents attached to 1v1-room assignments — the
--      assignment_attachments SELECT policy still only joined classroom enrollments,
--      so the join row itself was invisible even though the documents policy and the
--      storage helper had already been widened for 1v1 rooms (20260313120000).
--   2. Quizzes had no way to carry reference PDFs/docs at all. Adds quiz_attachments
--      (mirror of assignment_attachments) with the matching RLS + storage access.
--   3. Students could not read the profile of a tutor who teaches one of their
--      classrooms (only the 1v1-room mirror existed, added in 20260806120000).

-- ── 1. assignment_attachments: students in 1v1 rooms ────────────────────────────
DROP POLICY IF EXISTS "Students can view assignment attachments" ON public.assignment_attachments;
CREATE POLICY "Students can view assignment attachments"
  ON public.assignment_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_attachments.assignment_id
        AND a.status = 'published'
        AND (
          (a.classroom_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.enrollments e
            WHERE e.classroom_id = a.classroom_id
              AND e.student_id = auth.uid()
              AND e.status = 'active'
          ))
          OR (a.one_to_one_room_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.one_to_one_rooms o
            WHERE o.id = a.one_to_one_room_id
              AND o.student_id = auth.uid()
          ))
        )
    )
  );

-- Owners need to see the attachment rows for workspace assignments too (the owner
-- assignment views embed them); previously only teachers and students had SELECT.
DROP POLICY IF EXISTS "Owners can view assignment attachments in their workspace" ON public.assignment_attachments;
CREATE POLICY "Owners can view assignment attachments in their workspace"
  ON public.assignment_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_attachments.assignment_id
        AND (
          (a.classroom_id IS NOT NULL AND public.is_classroom_owned_by_owner(a.classroom_id, auth.uid()))
          OR (a.one_to_one_room_id IS NOT NULL AND public.is_one_to_one_room_in_owner_workspace(a.one_to_one_room_id, auth.uid()))
        )
    )
  );

-- ── 2. quiz_attachments ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quiz_attachments (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (quiz_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_quiz_attachments_quiz_id ON public.quiz_attachments (quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attachments_document_id ON public.quiz_attachments (document_id);

ALTER TABLE public.quiz_attachments ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.quiz_attachments TO anon;
GRANT ALL ON TABLE public.quiz_attachments TO authenticated;
GRANT ALL ON TABLE public.quiz_attachments TO service_role;

CREATE POLICY "Teachers can view their quiz attachments"
  ON public.quiz_attachments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_attachments.quiz_id AND q.teacher_id = auth.uid()));

CREATE POLICY "Teachers can add attachments to their quizzes"
  ON public.quiz_attachments FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_attachments.quiz_id AND q.teacher_id = auth.uid()));

CREATE POLICY "Teachers can remove attachments from their quizzes"
  ON public.quiz_attachments FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_attachments.quiz_id AND q.teacher_id = auth.uid()));

-- Students see attachments for any quiz they can already see (same status gate as the
-- quizzes SELECT policy: draft quizzes stay hidden).
CREATE POLICY "Students can view quiz attachments"
  ON public.quiz_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_attachments.quiz_id
        AND q.status IN ('scheduled', 'active', 'closed')
        AND (
          (q.classroom_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.enrollments e
            WHERE e.classroom_id = q.classroom_id
              AND e.student_id = auth.uid()
              AND e.status = 'active'
          ))
          OR (q.one_to_one_room_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.one_to_one_rooms o
            WHERE o.id = q.one_to_one_room_id
              AND o.student_id = auth.uid()
          ))
        )
    )
  );

CREATE POLICY "Owners can view quiz attachments in their workspace"
  ON public.quiz_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_attachments.quiz_id
        AND (
          (q.classroom_id IS NOT NULL AND public.is_classroom_owned_by_owner(q.classroom_id, auth.uid()))
          OR (q.one_to_one_room_id IS NOT NULL AND public.is_one_to_one_room_in_owner_workspace(q.one_to_one_room_id, auth.uid()))
        )
    )
  );

-- Students can read the `documents` row behind a quiz attachment.
CREATE POLICY "Students can view documents attached to quizzes"
  ON public.documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quiz_attachments qa
      JOIN public.quizzes q ON q.id = qa.quiz_id
      LEFT JOIN public.enrollments e
        ON e.classroom_id = q.classroom_id AND e.student_id = auth.uid() AND e.status = 'active'
      LEFT JOIN public.one_to_one_rooms o
        ON o.id = q.one_to_one_room_id AND o.student_id = auth.uid()
      WHERE qa.document_id = documents.id
        AND q.status IN ('scheduled', 'active', 'closed')
        AND (e.student_id IS NOT NULL OR o.student_id IS NOT NULL)
    )
  );

-- ...and download the underlying storage object.
CREATE OR REPLACE FUNCTION public.is_storage_object_attached_to_quiz(p_file_path text, p_student_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.documents d
    JOIN public.quiz_attachments qa ON qa.document_id = d.id
    JOIN public.quizzes q ON q.id = qa.quiz_id
    JOIN public.enrollments e ON e.classroom_id = q.classroom_id
    WHERE d.file_path = p_file_path
      AND q.status IN ('scheduled', 'active', 'closed')
      AND e.student_id = p_student_id
      AND e.status = 'active'
  )
  OR EXISTS (
    SELECT 1
    FROM public.documents d
    JOIN public.quiz_attachments qa ON qa.document_id = d.id
    JOIN public.quizzes q ON q.id = qa.quiz_id
    JOIN public.one_to_one_rooms o ON o.id = q.one_to_one_room_id
    WHERE d.file_path = p_file_path
      AND q.status IN ('scheduled', 'active', 'closed')
      AND o.student_id = p_student_id
  );
END;
$$;

DROP POLICY IF EXISTS "Students can download quiz attachment documents" ON storage.objects;
CREATE POLICY "Students can download quiz attachment documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documents' AND public.is_storage_object_attached_to_quiz(name, auth.uid()));

-- ── 3. Students can read the profile of a tutor who teaches their classroom ─────
-- Mirror of "Teachers can view profiles in their classrooms". Covers both the
-- classroom owner (classrooms.teacher_id) and co-tutors (classroom_tutors).
CREATE POLICY "Students can view profiles of tutors in their classrooms"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.enrollments e
      JOIN public.classrooms c ON c.id = e.classroom_id
      WHERE e.student_id = auth.uid()
        AND e.status = 'active'
        AND (
          c.teacher_id = profiles.user_id
          OR EXISTS (
            SELECT 1 FROM public.classroom_tutors ct
            WHERE ct.classroom_id = c.id AND ct.user_id = profiles.user_id
          )
        )
    )
  );
