-- ================================================================
-- Edulabloom – Sprint 1 & Sprint 2 schema
-- Paste into: Supabase Dashboard → SQL Editor → Run
-- ================================================================

-- ----------------------------------------------------------------
-- 1. profiles – add account_type and onboarding_completed_at
-- ----------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_type text
    CHECK (account_type IN ('business', 'solo_tutor', 'student')),
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

-- ----------------------------------------------------------------
-- 2. workspaces  (create BEFORE workspace_members)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspaces (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  type        text        NOT NULL CHECK (type IN ('business', 'solo')),
  owner_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  settings    jsonb       NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON public.workspaces(owner_id);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Owner can do everything on their own workspace
DROP POLICY IF EXISTS "Owners can manage own workspace" ON public.workspaces;
CREATE POLICY "Owners can manage own workspace"
  ON public.workspaces FOR ALL
  USING    (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- ----------------------------------------------------------------
-- 3. workspace_members  (create BEFORE the cross-ref policy on workspaces)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         text        NOT NULL CHECK (role IN ('owner', 'tutor')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id      ON public.workspace_members(user_id);

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view workspace members of their workspace" ON public.workspace_members;
CREATE POLICY "Users can view workspace members of their workspace"
  ON public.workspace_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_members.workspace_id
        AND w.owner_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Owners can insert workspace members" ON public.workspace_members;
CREATE POLICY "Owners can insert workspace members"
  ON public.workspace_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_members.workspace_id
        AND w.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can update workspace members" ON public.workspace_members;
CREATE POLICY "Owners can update workspace members"
  ON public.workspace_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_members.workspace_id
        AND w.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can delete workspace members" ON public.workspace_members;
CREATE POLICY "Owners can delete workspace members"
  ON public.workspace_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_members.workspace_id
        AND w.owner_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------
-- 4. NOW safe to add the cross-reference policy on workspaces
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Workspace members can view workspace" ON public.workspaces;
CREATE POLICY "Workspace members can view workspace"
  ON public.workspaces FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspaces.id
        AND wm.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------
-- 5. tutor_student_assignments
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tutor_student_assignments (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  tutor_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_tsa_workspace_id ON public.tutor_student_assignments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tsa_tutor_id     ON public.tutor_student_assignments(tutor_id);
CREATE INDEX IF NOT EXISTS idx_tsa_student_id   ON public.tutor_student_assignments(student_id);

ALTER TABLE public.tutor_student_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners and tutor can view tutor_student_assignments" ON public.tutor_student_assignments;
CREATE POLICY "Owners and tutor can view tutor_student_assignments"
  ON public.tutor_student_assignments FOR SELECT
  USING (
    tutor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = tutor_student_assignments.workspace_id
        AND w.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can manage tutor_student_assignments" ON public.tutor_student_assignments;
CREATE POLICY "Owners can manage tutor_student_assignments"
  ON public.tutor_student_assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = tutor_student_assignments.workspace_id
        AND w.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = tutor_student_assignments.workspace_id
        AND w.owner_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------
-- 6. classrooms – add nullable workspace_id column
-- ----------------------------------------------------------------
ALTER TABLE public.classrooms
  ADD COLUMN IF NOT EXISTS workspace_id uuid
    REFERENCES public.workspaces(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_classrooms_workspace_id ON public.classrooms(workspace_id);

-- ----------------------------------------------------------------
-- 7. updated_at trigger for workspaces
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_workspaces_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_workspaces_updated_at ON public.workspaces;
CREATE TRIGGER update_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.set_workspaces_updated_at();

-- ================================================================
-- SPRINT 2 – Owner RLS: allow workspace owner to read all
--            classrooms / assignments / quizzes / submissions /
--            documents / enrollments belonging to their workspace
-- ================================================================

-- Helper: is p_teacher_id a member of a workspace owned by p_owner_id?
CREATE OR REPLACE FUNCTION public.is_classroom_in_owner_workspace(
  p_teacher_id uuid,
  p_owner_id   uuid
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    JOIN public.workspaces w ON w.id = wm.workspace_id
    WHERE w.owner_id = p_owner_id
      AND wm.user_id = p_teacher_id
  );
$$;

-- classrooms
DROP POLICY IF EXISTS "Owners can view classrooms in their workspace" ON public.classrooms;
CREATE POLICY "Owners can view classrooms in their workspace"
  ON public.classrooms FOR SELECT
  USING (public.is_classroom_in_owner_workspace(teacher_id, auth.uid()));

-- assignments
DROP POLICY IF EXISTS "Owners can view assignments in their workspace" ON public.assignments;
CREATE POLICY "Owners can view assignments in their workspace"
  ON public.assignments FOR SELECT
  USING (public.is_classroom_in_owner_workspace(teacher_id, auth.uid()));

-- quizzes
DROP POLICY IF EXISTS "Owners can view quizzes in their workspace" ON public.quizzes;
CREATE POLICY "Owners can view quizzes in their workspace"
  ON public.quizzes FOR SELECT
  USING (public.is_classroom_in_owner_workspace(teacher_id, auth.uid()));

-- submissions
CREATE OR REPLACE FUNCTION public.is_submission_in_owner_workspace(
  p_assignment_id uuid,
  p_owner_id      uuid
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id = p_assignment_id
      AND public.is_classroom_in_owner_workspace(a.teacher_id, p_owner_id)
  );
$$;

DROP POLICY IF EXISTS "Owners can view submissions in their workspace" ON public.submissions;
CREATE POLICY "Owners can view submissions in their workspace"
  ON public.submissions FOR SELECT
  USING (public.is_submission_in_owner_workspace(assignment_id, auth.uid()));

-- documents
CREATE OR REPLACE FUNCTION public.is_document_user_in_owner_workspace(
  p_user_id  uuid,
  p_owner_id uuid
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    JOIN public.workspaces w ON w.id = wm.workspace_id
    WHERE w.owner_id = p_owner_id
      AND wm.user_id = p_user_id
  );
$$;

DROP POLICY IF EXISTS "Owners can view documents in their workspace" ON public.documents;
CREATE POLICY "Owners can view documents in their workspace"
  ON public.documents FOR SELECT
  USING (public.is_document_user_in_owner_workspace(user_id, auth.uid()));

-- enrollments (for student profile page)
CREATE OR REPLACE FUNCTION public.is_enrollment_classroom_in_owner_workspace(
  p_classroom_id uuid,
  p_owner_id     uuid
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classrooms c
    WHERE c.id = p_classroom_id
      AND public.is_classroom_in_owner_workspace(c.teacher_id, p_owner_id)
  );
$$;

DROP POLICY IF EXISTS "Owners can view enrollments in their workspace" ON public.enrollments;
CREATE POLICY "Owners can view enrollments in their workspace"
  ON public.enrollments FOR SELECT
  USING (public.is_enrollment_classroom_in_owner_workspace(classroom_id, auth.uid()));
