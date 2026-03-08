-- ================================================================
-- Lecture sessions + tutor-owned Google Calendar connections
-- Sprint 1 foundation for classroom lecture scheduling with Meet
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Helpers
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_classroom_in_workspace(
  p_classroom_id uuid,
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
    FROM public.classrooms c
    WHERE c.id = p_classroom_id
      AND c.workspace_id = p_workspace_id
  );
$$;

-- ----------------------------------------------------------------
-- 2. Tutor Google Calendar connection storage
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.google_calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  google_email text,
  google_calendar_id text NOT NULL DEFAULT 'primary',
  access_token text NOT NULL,
  refresh_token text,
  token_type text,
  scope text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_google_calendar_connections_user_id
  ON public.google_calendar_connections(user_id);

ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own Google calendar connection" ON public.google_calendar_connections;
CREATE POLICY "Users can view own Google calendar connection"
  ON public.google_calendar_connections FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own Google calendar connection" ON public.google_calendar_connections;
CREATE POLICY "Users can insert own Google calendar connection"
  ON public.google_calendar_connections FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own Google calendar connection" ON public.google_calendar_connections;
CREATE POLICY "Users can update own Google calendar connection"
  ON public.google_calendar_connections FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own Google calendar connection" ON public.google_calendar_connections;
CREATE POLICY "Users can delete own Google calendar connection"
  ON public.google_calendar_connections FOR DELETE
  USING (user_id = auth.uid());

COMMENT ON TABLE public.google_calendar_connections IS
  'Tutor-owned Google Calendar OAuth connection used to create Google Meet lecture sessions.';

-- ----------------------------------------------------------------
-- 3. Lecture sessions
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  classroom_id uuid NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  tutor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status = ANY (ARRAY['scheduled'::text, 'cancelled'::text, 'completed'::text])),
  meeting_provider text NOT NULL DEFAULT 'google_meet'
    CHECK (meeting_provider = ANY (ARRAY['google_meet'::text, 'manual'::text])),
  meeting_url text,
  external_event_id text,
  google_calendar_id text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sessions_time_order CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_sessions_workspace_starts_at
  ON public.sessions(workspace_id, starts_at);

CREATE INDEX IF NOT EXISTS idx_sessions_classroom_starts_at
  ON public.sessions(classroom_id, starts_at);

CREATE INDEX IF NOT EXISTS idx_sessions_tutor_starts_at
  ON public.sessions(tutor_id, starts_at);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view sessions in their workspace" ON public.sessions;
CREATE POLICY "Owners can view sessions in their workspace"
  ON public.sessions FOR SELECT
  USING (public.is_workspace_owner(workspace_id));

DROP POLICY IF EXISTS "Tutors can view sessions for their classrooms" ON public.sessions;
CREATE POLICY "Tutors can view sessions for their classrooms"
  ON public.sessions FOR SELECT
  USING (
    tutor_id = auth.uid()
    OR public.is_user_tutor_of_classroom(auth.uid(), classroom_id)
  );

DROP POLICY IF EXISTS "Students can view sessions in enrolled classrooms" ON public.sessions;
CREATE POLICY "Students can view sessions in enrolled classrooms"
  ON public.sessions FOR SELECT
  USING (public.is_enrolled_in_classroom(auth.uid(), classroom_id));

DROP POLICY IF EXISTS "Owners can insert sessions in their workspace" ON public.sessions;
CREATE POLICY "Owners can insert sessions in their workspace"
  ON public.sessions FOR INSERT
  WITH CHECK (
    public.is_workspace_owner(workspace_id)
    AND public.is_classroom_in_workspace(classroom_id, workspace_id)
    AND public.is_user_tutor_of_classroom(tutor_id, classroom_id)
  );

DROP POLICY IF EXISTS "Tutors can insert sessions for own classrooms" ON public.sessions;
CREATE POLICY "Tutors can insert sessions for own classrooms"
  ON public.sessions FOR INSERT
  WITH CHECK (
    tutor_id = auth.uid()
    AND public.is_classroom_in_workspace(classroom_id, workspace_id)
    AND public.is_user_tutor_of_classroom(auth.uid(), classroom_id)
  );

DROP POLICY IF EXISTS "Owners can update sessions in their workspace" ON public.sessions;
CREATE POLICY "Owners can update sessions in their workspace"
  ON public.sessions FOR UPDATE
  USING (public.is_workspace_owner(workspace_id))
  WITH CHECK (
    public.is_workspace_owner(workspace_id)
    AND public.is_classroom_in_workspace(classroom_id, workspace_id)
    AND public.is_user_tutor_of_classroom(tutor_id, classroom_id)
  );

DROP POLICY IF EXISTS "Tutors can update own classroom sessions" ON public.sessions;
CREATE POLICY "Tutors can update own classroom sessions"
  ON public.sessions FOR UPDATE
  USING (
    tutor_id = auth.uid()
    AND public.is_user_tutor_of_classroom(auth.uid(), classroom_id)
  )
  WITH CHECK (
    tutor_id = auth.uid()
    AND public.is_classroom_in_workspace(classroom_id, workspace_id)
    AND public.is_user_tutor_of_classroom(auth.uid(), classroom_id)
  );

DROP POLICY IF EXISTS "Owners can delete sessions in their workspace" ON public.sessions;
CREATE POLICY "Owners can delete sessions in their workspace"
  ON public.sessions FOR DELETE
  USING (public.is_workspace_owner(workspace_id));

DROP POLICY IF EXISTS "Tutors can delete own classroom sessions" ON public.sessions;
CREATE POLICY "Tutors can delete own classroom sessions"
  ON public.sessions FOR DELETE
  USING (
    tutor_id = auth.uid()
    AND public.is_user_tutor_of_classroom(auth.uid(), classroom_id)
  );

COMMENT ON TABLE public.sessions IS
  'Scheduled classroom lecture sessions with optional Google Meet data.';
