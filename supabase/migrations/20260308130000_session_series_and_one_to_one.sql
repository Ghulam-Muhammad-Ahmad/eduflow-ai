-- ================================================================
-- Sprint 2: one-to-one lecture sessions + recurring series
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Helper for owner/tutor managing one-to-one student sessions
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_manage_student_assignment(
  p_student_id uuid,
  p_tutor_id uuid,
  p_workspace_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tutor_student_assignments tsa
    WHERE tsa.workspace_id = p_workspace_id
      AND tsa.student_id = p_student_id
      AND tsa.tutor_id = p_tutor_id
      AND (
        tsa.tutor_id = auth.uid()
        OR public.is_workspace_owner(p_workspace_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_student_session(
  p_student_id uuid,
  p_tutor_id uuid,
  p_workspace_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() = p_student_id
    AND EXISTS (
      SELECT 1
      FROM public.tutor_student_assignments tsa
      WHERE tsa.workspace_id = p_workspace_id
        AND tsa.student_id = p_student_id
        AND tsa.tutor_id = p_tutor_id
    );
$$;

-- ----------------------------------------------------------------
-- 2. Series parent for recurring sessions
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.session_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  scope_type text NOT NULL CHECK (scope_type = ANY (ARRAY['classroom'::text, 'one_to_one'::text])),
  classroom_id uuid REFERENCES public.classrooms(id) ON DELETE CASCADE,
  student_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  tutor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  recurrence_frequency text NOT NULL CHECK (recurrence_frequency = ANY (ARRAY['daily'::text, 'weekly'::text])),
  recurrence_interval integer NOT NULL DEFAULT 1 CHECK (recurrence_interval > 0),
  occurrences_count integer NOT NULL CHECK (occurrences_count > 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT session_series_scope_target_check CHECK (
    (scope_type = 'classroom' AND classroom_id IS NOT NULL AND student_id IS NULL)
    OR (scope_type = 'one_to_one' AND classroom_id IS NULL AND student_id IS NOT NULL)
  ),
  CONSTRAINT session_series_time_order CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_session_series_workspace_id
  ON public.session_series(workspace_id);

ALTER TABLE public.session_series ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view session series in their workspace" ON public.session_series;
CREATE POLICY "Owners can view session series in their workspace"
  ON public.session_series FOR SELECT
  USING (public.is_workspace_owner(workspace_id));

DROP POLICY IF EXISTS "Tutors can view own session series" ON public.session_series;
CREATE POLICY "Tutors can view own session series"
  ON public.session_series FOR SELECT
  USING (
    tutor_id = auth.uid()
    OR (scope_type = 'classroom' AND classroom_id IS NOT NULL AND public.is_user_tutor_of_classroom(auth.uid(), classroom_id))
  );

DROP POLICY IF EXISTS "Students can view own one to one session series" ON public.session_series;
CREATE POLICY "Students can view own one to one session series"
  ON public.session_series FOR SELECT
  USING (
    scope_type = 'one_to_one'
    AND student_id IS NOT NULL
    AND public.can_view_student_session(student_id, tutor_id, workspace_id)
  );

DROP POLICY IF EXISTS "Students can view classroom session series" ON public.session_series;
CREATE POLICY "Students can view classroom session series"
  ON public.session_series FOR SELECT
  USING (
    scope_type = 'classroom'
    AND classroom_id IS NOT NULL
    AND public.is_enrolled_in_classroom(auth.uid(), classroom_id)
  );

DROP POLICY IF EXISTS "Owners can insert session series in workspace" ON public.session_series;
CREATE POLICY "Owners can insert session series in workspace"
  ON public.session_series FOR INSERT
  WITH CHECK (
    public.is_workspace_owner(workspace_id)
    AND (
      (scope_type = 'classroom' AND classroom_id IS NOT NULL AND public.is_classroom_in_workspace(classroom_id, workspace_id) AND public.is_user_tutor_of_classroom(tutor_id, classroom_id))
      OR (scope_type = 'one_to_one' AND student_id IS NOT NULL AND public.can_manage_student_assignment(student_id, tutor_id, workspace_id))
    )
  );

DROP POLICY IF EXISTS "Tutors can insert own session series" ON public.session_series;
CREATE POLICY "Tutors can insert own session series"
  ON public.session_series FOR INSERT
  WITH CHECK (
    tutor_id = auth.uid()
    AND (
      (scope_type = 'classroom' AND classroom_id IS NOT NULL AND public.is_classroom_in_workspace(classroom_id, workspace_id) AND public.is_user_tutor_of_classroom(auth.uid(), classroom_id))
      OR (scope_type = 'one_to_one' AND student_id IS NOT NULL AND public.can_manage_student_assignment(student_id, auth.uid(), workspace_id))
    )
  );

DROP POLICY IF EXISTS "Owners can update session series in workspace" ON public.session_series;
CREATE POLICY "Owners can update session series in workspace"
  ON public.session_series FOR UPDATE
  USING (public.is_workspace_owner(workspace_id))
  WITH CHECK (public.is_workspace_owner(workspace_id));

DROP POLICY IF EXISTS "Tutors can update own session series" ON public.session_series;
CREATE POLICY "Tutors can update own session series"
  ON public.session_series FOR UPDATE
  USING (tutor_id = auth.uid())
  WITH CHECK (tutor_id = auth.uid());

DROP POLICY IF EXISTS "Owners can delete session series in workspace" ON public.session_series;
CREATE POLICY "Owners can delete session series in workspace"
  ON public.session_series FOR DELETE
  USING (public.is_workspace_owner(workspace_id));

DROP POLICY IF EXISTS "Tutors can delete own session series" ON public.session_series;
CREATE POLICY "Tutors can delete own session series"
  ON public.session_series FOR DELETE
  USING (tutor_id = auth.uid());

COMMENT ON TABLE public.session_series IS
  'Recurring lecture series metadata used to generate concrete session rows.';

-- ----------------------------------------------------------------
-- 3. Extend sessions to support one-to-one and recurrence
-- ----------------------------------------------------------------
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS scope_type text NOT NULL DEFAULT 'classroom'
    CHECK (scope_type = ANY (ARRAY['classroom'::text, 'one_to_one'::text]));

ALTER TABLE public.sessions
  ALTER COLUMN classroom_id DROP NOT NULL;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS series_id uuid REFERENCES public.session_series(id) ON DELETE SET NULL;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS occurrence_index integer;

ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_time_order;

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_time_order CHECK (ends_at > starts_at);

ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_scope_target_check;

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_scope_target_check CHECK (
    (scope_type = 'classroom' AND classroom_id IS NOT NULL AND student_id IS NULL)
    OR (scope_type = 'one_to_one' AND classroom_id IS NULL AND student_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_sessions_student_starts_at
  ON public.sessions(student_id, starts_at);

CREATE INDEX IF NOT EXISTS idx_sessions_series_occurrence
  ON public.sessions(series_id, occurrence_index);

-- ----------------------------------------------------------------
-- 4. Rebuild session RLS for both scope types
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Owners can view sessions in their workspace" ON public.sessions;
CREATE POLICY "Owners can view sessions in their workspace"
  ON public.sessions FOR SELECT
  USING (public.is_workspace_owner(workspace_id));

DROP POLICY IF EXISTS "Tutors can view sessions for their classrooms" ON public.sessions;
CREATE POLICY "Tutors can view sessions they manage"
  ON public.sessions FOR SELECT
  USING (
    tutor_id = auth.uid()
    OR (
      scope_type = 'classroom'
      AND classroom_id IS NOT NULL
      AND public.is_user_tutor_of_classroom(auth.uid(), classroom_id)
    )
  );

DROP POLICY IF EXISTS "Students can view sessions in enrolled classrooms" ON public.sessions;
CREATE POLICY "Students can view classroom sessions"
  ON public.sessions FOR SELECT
  USING (
    scope_type = 'classroom'
    AND classroom_id IS NOT NULL
    AND public.is_enrolled_in_classroom(auth.uid(), classroom_id)
  );

DROP POLICY IF EXISTS "Students can view own one to one sessions" ON public.sessions;
CREATE POLICY "Students can view own one to one sessions"
  ON public.sessions FOR SELECT
  USING (
    scope_type = 'one_to_one'
    AND student_id IS NOT NULL
    AND public.can_view_student_session(student_id, tutor_id, workspace_id)
  );

DROP POLICY IF EXISTS "Owners can insert sessions in their workspace" ON public.sessions;
CREATE POLICY "Owners can insert sessions in their workspace"
  ON public.sessions FOR INSERT
  WITH CHECK (
    public.is_workspace_owner(workspace_id)
    AND (
      (scope_type = 'classroom' AND classroom_id IS NOT NULL AND public.is_classroom_in_workspace(classroom_id, workspace_id) AND public.is_user_tutor_of_classroom(tutor_id, classroom_id))
      OR (scope_type = 'one_to_one' AND student_id IS NOT NULL AND public.can_manage_student_assignment(student_id, tutor_id, workspace_id))
    )
  );

DROP POLICY IF EXISTS "Tutors can insert sessions for own classrooms" ON public.sessions;
CREATE POLICY "Tutors can insert sessions they manage"
  ON public.sessions FOR INSERT
  WITH CHECK (
    tutor_id = auth.uid()
    AND (
      (scope_type = 'classroom' AND classroom_id IS NOT NULL AND public.is_classroom_in_workspace(classroom_id, workspace_id) AND public.is_user_tutor_of_classroom(auth.uid(), classroom_id))
      OR (scope_type = 'one_to_one' AND student_id IS NOT NULL AND public.can_manage_student_assignment(student_id, auth.uid(), workspace_id))
    )
  );

DROP POLICY IF EXISTS "Owners can update sessions in their workspace" ON public.sessions;
CREATE POLICY "Owners can update sessions in their workspace"
  ON public.sessions FOR UPDATE
  USING (public.is_workspace_owner(workspace_id))
  WITH CHECK (public.is_workspace_owner(workspace_id));

DROP POLICY IF EXISTS "Tutors can update own classroom sessions" ON public.sessions;
CREATE POLICY "Tutors can update sessions they manage"
  ON public.sessions FOR UPDATE
  USING (tutor_id = auth.uid())
  WITH CHECK (tutor_id = auth.uid());

DROP POLICY IF EXISTS "Owners can delete sessions in their workspace" ON public.sessions;
CREATE POLICY "Owners can delete sessions in their workspace"
  ON public.sessions FOR DELETE
  USING (public.is_workspace_owner(workspace_id));

DROP POLICY IF EXISTS "Tutors can delete own classroom sessions" ON public.sessions;
CREATE POLICY "Tutors can delete sessions they manage"
  ON public.sessions FOR DELETE
  USING (tutor_id = auth.uid());
