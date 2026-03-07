-- ================================================================
-- Owner-managed classrooms: classroom_tutors, join_code nullable,
-- owner INSERT/UPDATE classrooms & enrollments, drop student self-join
-- ================================================================

-- ----------------------------------------------------------------
-- 1. classroom_tutors (multiple tutors per classroom)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.classroom_tutors (
  classroom_id uuid NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (classroom_id, user_id),
  UNIQUE (classroom_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_classroom_tutors_classroom_id ON public.classroom_tutors(classroom_id);
CREATE INDEX IF NOT EXISTS idx_classroom_tutors_user_id ON public.classroom_tutors(user_id);

ALTER TABLE public.classroom_tutors ENABLE ROW LEVEL SECURITY;

-- Owners: SELECT/INSERT/DELETE when classroom is in a workspace they own
CREATE POLICY "Owners can manage classroom_tutors in their workspace"
  ON public.classroom_tutors FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.classrooms c
      JOIN public.workspaces w ON w.id = c.workspace_id
      WHERE c.id = classroom_tutors.classroom_id
        AND w.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classrooms c
      JOIN public.workspaces w ON w.id = c.workspace_id
      WHERE c.id = classroom_tutors.classroom_id
        AND w.owner_id = auth.uid()
    )
  );

-- Tutors: SELECT when they are teacher_id or in classroom_tutors for that classroom
CREATE POLICY "Tutors can view classroom_tutors for their classrooms"
  ON public.classroom_tutors FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = classroom_tutors.classroom_id
        AND c.teacher_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------
-- 2. classrooms: make join_code nullable
-- ----------------------------------------------------------------
ALTER TABLE public.classrooms
  ALTER COLUMN join_code DROP NOT NULL;

-- Drop unique constraint on join_code so multiple rows can have NULL
-- (Postgres allows multiple NULLs in UNIQUE by default; we keep UNIQUE for non-null codes)
-- No change needed if we only need nullable; existing UNIQUE still allows one NULL in PG.
-- To allow multiple NULLs explicitly:
ALTER TABLE public.classrooms DROP CONSTRAINT IF EXISTS classrooms_join_code_key;

-- Re-add unique only for non-null (optional; omit if we want multiple NULLs)
-- In Postgres, UNIQUE allows multiple NULLs. So just DROP NOT NULL is enough.
-- If there was a unique constraint name from initial migration, it might be classrooms_join_code_key.

-- Ensure workspace_id exists (already added in 20260228100000)
-- ALTER TABLE public.classrooms ADD COLUMN IF NOT EXISTS workspace_id ...

-- ----------------------------------------------------------------
-- 3. Helper: is classroom in a workspace owned by owner (by classroom_id)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_classroom_owned_by_owner(
  p_classroom_id uuid,
  p_owner_id     uuid
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classrooms c
    JOIN public.workspaces w ON w.id = c.workspace_id
    WHERE c.id = p_classroom_id
      AND w.owner_id = p_owner_id
  );
$$;

-- Helper: can owner insert this classroom? (workspace owned by them, teacher in that workspace)
CREATE OR REPLACE FUNCTION public.owner_can_insert_classroom(
  p_workspace_id uuid,
  p_teacher_id   uuid,
  p_owner_id     uuid
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = p_workspace_id
      AND w.owner_id = p_owner_id
  )
  AND EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = p_workspace_id
      AND wm.user_id = p_teacher_id
  );
$$;

-- ----------------------------------------------------------------
-- 4. classrooms RLS: owner INSERT and UPDATE; remove teacher INSERT
-- ----------------------------------------------------------------
-- Only owners create classrooms; teachers no longer create
DROP POLICY IF EXISTS "Teachers can create classrooms" ON public.classrooms;

-- Owner INSERT: workspace_id set, workspace owned by auth.uid(), teacher_id in workspace_members
DROP POLICY IF EXISTS "Owners can insert classrooms in their workspace" ON public.classrooms;
CREATE POLICY "Owners can insert classrooms in their workspace"
  ON public.classrooms FOR INSERT
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.owner_can_insert_classroom(workspace_id, teacher_id, auth.uid())
  );

-- Owner UPDATE (reassign teacher_id, etc.) when classroom is in their workspace
DROP POLICY IF EXISTS "Owners can update classrooms in their workspace" ON public.classrooms;
CREATE POLICY "Owners can update classrooms in their workspace"
  ON public.classrooms FOR UPDATE
  USING (public.is_classroom_owned_by_owner(id, auth.uid()))
  WITH CHECK (public.is_classroom_owned_by_owner(id, auth.uid()));

-- Teachers: allow UPDATE for their own classrooms (teacher_id or in classroom_tutors)
-- Replace existing "Teachers can update their own classrooms" to include classroom_tutors
DROP POLICY IF EXISTS "Teachers can update their own classrooms" ON public.classrooms;
CREATE POLICY "Teachers can update their own classrooms"
  ON public.classrooms FOR UPDATE
  USING (
    teacher_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.classroom_tutors ct
      WHERE ct.classroom_id = classrooms.id
        AND ct.user_id = auth.uid()
    )
  )
  WITH CHECK (
    teacher_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.classroom_tutors ct
      WHERE ct.classroom_id = classrooms.id
        AND ct.user_id = auth.uid()
    )
  );

-- Owners can view classrooms in their workspace (by workspace_id)
DROP POLICY IF EXISTS "Owners can view classrooms in their workspace" ON public.classrooms;
CREATE POLICY "Owners can view classrooms in their workspace"
  ON public.classrooms FOR SELECT
  USING (
    workspace_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = classrooms.workspace_id
        AND w.owner_id = auth.uid()
    )
  );

-- Teachers: also view classrooms where they are in classroom_tutors (in addition to teacher_id)
DROP POLICY IF EXISTS "Teachers can view their own classrooms" ON public.classrooms;
CREATE POLICY "Teachers can view their own classrooms"
  ON public.classrooms FOR SELECT
  USING (
    teacher_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.classroom_tutors ct
      WHERE ct.classroom_id = classrooms.id
        AND ct.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------
-- 5. is_classroom_teacher: include classroom_tutors
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_classroom_teacher(_user_id uuid, _classroom_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.classrooms c
    WHERE c.id = _classroom_id
      AND c.teacher_id = _user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.classroom_tutors ct
    WHERE ct.classroom_id = _classroom_id
      AND ct.user_id = _user_id
  );
$$;

-- ----------------------------------------------------------------
-- 6. enrollments: is_enrollment_classroom_in_owner_workspace, then owner INSERT/UPDATE, drop student self-join
-- ----------------------------------------------------------------
-- is_enrollment_classroom_in_owner_workspace: classroom in workspace owned by owner, or teacher in owner workspace
CREATE OR REPLACE FUNCTION public.is_enrollment_classroom_in_owner_workspace(
  p_classroom_id uuid,
  p_owner_id     uuid
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classrooms c
    WHERE c.id = p_classroom_id
      AND (
        (c.workspace_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.workspaces w
          WHERE w.id = c.workspace_id AND w.owner_id = p_owner_id
        ))
        OR public.is_classroom_in_owner_workspace(c.teacher_id, p_owner_id)
      )
  );
$$;

DROP POLICY IF EXISTS "Students can join classrooms" ON public.enrollments;

DROP POLICY IF EXISTS "Owners can insert enrollments in their workspace" ON public.enrollments;
CREATE POLICY "Owners can insert enrollments in their workspace"
  ON public.enrollments FOR INSERT
  WITH CHECK (public.is_enrollment_classroom_in_owner_workspace(classroom_id, auth.uid()));

-- Owners can update enrollments (e.g. remove student) when classroom is in their workspace
DROP POLICY IF EXISTS "Owners can update enrollments in their workspace" ON public.enrollments;
CREATE POLICY "Owners can update enrollments in their workspace"
  ON public.enrollments FOR UPDATE
  USING (public.is_enrollment_classroom_in_owner_workspace(classroom_id, auth.uid()))
  WITH CHECK (public.is_enrollment_classroom_in_owner_workspace(classroom_id, auth.uid()));
