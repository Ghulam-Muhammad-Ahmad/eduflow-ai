-- ================================================================
-- Sprint 3: post-session completion + private tutor notes
-- ================================================================

CREATE TABLE IF NOT EXISTS public.session_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL UNIQUE REFERENCES public.sessions(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  tutor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_notes_workspace_id
  ON public.session_notes(workspace_id);

CREATE INDEX IF NOT EXISTS idx_session_notes_tutor_id
  ON public.session_notes(tutor_id);

ALTER TABLE public.session_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view private session notes in workspace" ON public.session_notes;
CREATE POLICY "Owners can view private session notes in workspace"
  ON public.session_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.sessions s
      WHERE s.id = session_notes.session_id
        AND public.is_workspace_owner(s.workspace_id)
    )
  );

DROP POLICY IF EXISTS "Tutors can view own private session notes" ON public.session_notes;
CREATE POLICY "Tutors can view own private session notes"
  ON public.session_notes FOR SELECT
  USING (tutor_id = auth.uid());

DROP POLICY IF EXISTS "Tutors can insert own private session notes" ON public.session_notes;
CREATE POLICY "Tutors can insert own private session notes"
  ON public.session_notes FOR INSERT
  WITH CHECK (
    tutor_id = auth.uid()
    AND created_by_user_id = auth.uid()
    AND updated_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.sessions s
      WHERE s.id = session_notes.session_id
        AND s.workspace_id = session_notes.workspace_id
        AND s.tutor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Tutors can update own private session notes" ON public.session_notes;
CREATE POLICY "Tutors can update own private session notes"
  ON public.session_notes FOR UPDATE
  USING (tutor_id = auth.uid())
  WITH CHECK (
    tutor_id = auth.uid()
    AND updated_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.sessions s
      WHERE s.id = session_notes.session_id
        AND s.workspace_id = session_notes.workspace_id
        AND s.tutor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Tutors can delete own private session notes" ON public.session_notes;
CREATE POLICY "Tutors can delete own private session notes"
  ON public.session_notes FOR DELETE
  USING (tutor_id = auth.uid());

COMMENT ON TABLE public.session_notes IS
  'Private tutor post-session notes. Visible to the assigned tutor and workspace owners, hidden from students.';
