-- ================================================================
-- Sprint 4: mock billing and payroll previews
-- ================================================================

CREATE TABLE IF NOT EXISTS public.session_financial_mock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL UNIQUE REFERENCES public.sessions(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  tutor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tutor_rate_amount numeric NOT NULL DEFAULT 0,
  tutor_rate_currency text NOT NULL DEFAULT 'GBP',
  tutor_rate_type text NOT NULL DEFAULT 'hourly'
    CHECK (tutor_rate_type = ANY (ARRAY['hourly'::text, 'per_session'::text])),
  student_charge_amount numeric NOT NULL DEFAULT 0,
  student_charge_currency text NOT NULL DEFAULT 'GBP',
  student_charge_type text NOT NULL DEFAULT 'per_session'
    CHECK (student_charge_type = ANY (ARRAY['hourly'::text, 'per_session'::text, 'per_student'::text])),
  created_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_financial_mock_workspace_id
  ON public.session_financial_mock(workspace_id);

CREATE INDEX IF NOT EXISTS idx_session_financial_mock_tutor_id
  ON public.session_financial_mock(tutor_id);

ALTER TABLE public.session_financial_mock ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view session financial mock in workspace" ON public.session_financial_mock;
CREATE POLICY "Owners can view session financial mock in workspace"
  ON public.session_financial_mock FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.sessions s
      WHERE s.id = session_financial_mock.session_id
        AND public.is_workspace_owner(s.workspace_id)
    )
  );

DROP POLICY IF EXISTS "Tutors can view own session financial mock" ON public.session_financial_mock;
CREATE POLICY "Tutors can view own session financial mock"
  ON public.session_financial_mock FOR SELECT
  USING (tutor_id = auth.uid());

DROP POLICY IF EXISTS "Owners can insert session financial mock in workspace" ON public.session_financial_mock;
CREATE POLICY "Owners can insert session financial mock in workspace"
  ON public.session_financial_mock FOR INSERT
  WITH CHECK (
    created_by_user_id = auth.uid()
    AND updated_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.sessions s
      WHERE s.id = session_financial_mock.session_id
        AND s.workspace_id = session_financial_mock.workspace_id
        AND s.tutor_id = session_financial_mock.tutor_id
        AND public.is_workspace_owner(s.workspace_id)
    )
  );

DROP POLICY IF EXISTS "Tutors can insert own session financial mock" ON public.session_financial_mock;
CREATE POLICY "Tutors can insert own session financial mock"
  ON public.session_financial_mock FOR INSERT
  WITH CHECK (
    tutor_id = auth.uid()
    AND created_by_user_id = auth.uid()
    AND updated_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.sessions s
      WHERE s.id = session_financial_mock.session_id
        AND s.workspace_id = session_financial_mock.workspace_id
        AND s.tutor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can update session financial mock in workspace" ON public.session_financial_mock;
CREATE POLICY "Owners can update session financial mock in workspace"
  ON public.session_financial_mock FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.sessions s
      WHERE s.id = session_financial_mock.session_id
        AND public.is_workspace_owner(s.workspace_id)
    )
  )
  WITH CHECK (
    updated_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.sessions s
      WHERE s.id = session_financial_mock.session_id
        AND s.workspace_id = session_financial_mock.workspace_id
        AND s.tutor_id = session_financial_mock.tutor_id
        AND public.is_workspace_owner(s.workspace_id)
    )
  );

DROP POLICY IF EXISTS "Tutors can update own session financial mock" ON public.session_financial_mock;
CREATE POLICY "Tutors can update own session financial mock"
  ON public.session_financial_mock FOR UPDATE
  USING (tutor_id = auth.uid())
  WITH CHECK (
    tutor_id = auth.uid()
    AND updated_by_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Owners can delete session financial mock in workspace" ON public.session_financial_mock;
CREATE POLICY "Owners can delete session financial mock in workspace"
  ON public.session_financial_mock FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.sessions s
      WHERE s.id = session_financial_mock.session_id
        AND public.is_workspace_owner(s.workspace_id)
    )
  );

DROP POLICY IF EXISTS "Tutors can delete own session financial mock" ON public.session_financial_mock;
CREATE POLICY "Tutors can delete own session financial mock"
  ON public.session_financial_mock FOR DELETE
  USING (tutor_id = auth.uid());

COMMENT ON TABLE public.session_financial_mock IS
  'Mock-only pricing inputs used to derive payroll and revenue previews from completed sessions.';
