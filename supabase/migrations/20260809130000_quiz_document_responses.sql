-- Document-based quizzes.
--
-- Until now a quiz was only usable if the teacher built out quiz_questions rows:
-- the builder refused to save without at least one question, and the student
-- take screen sat on "Loading quiz..." forever when a quiz had none.
--
-- Teachers who attach the paper as a document (quiz_attachments, added in
-- 20260808120000) want the document itself to be the question set. This adds the
-- student-response side of that: an attempt can now carry a free-text answer
-- and/or an uploaded file instead of per-question answers, and the teacher marks
-- it by hand.

-- ── quizzes: marks available on a document-response quiz ────────────────────────
-- Only meaningful when the quiz has no quiz_questions rows; question-based
-- quizzes keep deriving points_possible from their questions.
ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS response_points numeric(5,2) DEFAULT 100 NOT NULL;

COMMENT ON COLUMN public.quizzes.response_points IS
  'Marks available for a document-response quiz (one with no quiz_questions rows). Ignored when the quiz has questions.';

-- ── quiz_attempts: the student''s document response ─────────────────────────────
ALTER TABLE public.quiz_attempts
  ADD COLUMN IF NOT EXISTS response_text text;

ALTER TABLE public.quiz_attempts
  ADD COLUMN IF NOT EXISTS response_file_path text;

ALTER TABLE public.quiz_attempts
  ADD COLUMN IF NOT EXISTS response_file_name text;

ALTER TABLE public.quiz_attempts
  ADD COLUMN IF NOT EXISTS response_file_size bigint;

COMMENT ON COLUMN public.quiz_attempts.response_text IS
  'Free-text answer for a document-response quiz. Null for question-based quizzes.';
COMMENT ON COLUMN public.quiz_attempts.response_file_path IS
  'Storage path in the `submissions` bucket for a file uploaded as the answer.';

-- ── Teachers and owners can download a student''s quiz response file ────────────
-- The existing "Teachers can view student file submissions" policy only covers
-- the assignment `submissions` table, so quiz response uploads need their own
-- reachability check.
CREATE OR REPLACE FUNCTION public.is_storage_object_quiz_response(p_file_path text, p_viewer_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  -- The teacher who owns the quiz.
  RETURN EXISTS (
    SELECT 1
    FROM public.quiz_attempts qa
    JOIN public.quizzes q ON q.id = qa.quiz_id
    WHERE qa.response_file_path = p_file_path
      AND q.teacher_id = p_viewer_id
  )
  -- A co-tutor on the quiz''s classroom.
  OR EXISTS (
    SELECT 1
    FROM public.quiz_attempts qa
    JOIN public.quizzes q ON q.id = qa.quiz_id
    JOIN public.classroom_tutors ct ON ct.classroom_id = q.classroom_id
    WHERE qa.response_file_path = p_file_path
      AND ct.user_id = p_viewer_id
  )
  -- The workspace owner, for both classroom and 1v1 quizzes.
  OR EXISTS (
    SELECT 1
    FROM public.quiz_attempts qa
    JOIN public.quizzes q ON q.id = qa.quiz_id
    WHERE qa.response_file_path = p_file_path
      AND (
        (q.classroom_id IS NOT NULL AND public.is_classroom_owned_by_owner(q.classroom_id, p_viewer_id))
        OR (q.one_to_one_room_id IS NOT NULL AND public.is_one_to_one_room_in_owner_workspace(q.one_to_one_room_id, p_viewer_id))
      )
  );
END;
$$;

DROP POLICY IF EXISTS "Teachers can view quiz response files" ON storage.objects;
CREATE POLICY "Teachers can view quiz response files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'submissions' AND public.is_storage_object_quiz_response(name, auth.uid()));

-- Students already upload to and read from `submissions` under their own uid
-- folder ("Students can upload submissions" / "Students can view their own file
-- submissions" in the base schema), so no new student-side storage policy is
-- needed — quiz responses use the same `{uid}/...` path convention.

-- ── Owners need to read attempts to review document responses ───────────────────
DROP POLICY IF EXISTS "Owners can view quiz attempts in their workspace" ON public.quiz_attempts;
CREATE POLICY "Owners can view quiz attempts in their workspace"
  ON public.quiz_attempts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_attempts.quiz_id
        AND (
          (q.classroom_id IS NOT NULL AND public.is_classroom_owned_by_owner(q.classroom_id, auth.uid()))
          OR (q.one_to_one_room_id IS NOT NULL AND public.is_one_to_one_room_in_owner_workspace(q.one_to_one_room_id, auth.uid()))
        )
    )
  );
