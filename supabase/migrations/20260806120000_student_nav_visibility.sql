-- Student sidebar nav visibility (workspace default + per-student override), plus a
-- companion fix so a student can read the tutor profile for their own 1v1 rooms.
--
-- workspace_students previously had no `settings` column, no student self-read policy,
-- and no UPDATE policy at all (not even for the owner). All three are needed so the
-- owner can store a per-student nav override and the student can read both that
-- override and the workspace-wide default.

ALTER TABLE public.workspace_students
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.workspace_students.settings IS
  'Per-student overrides scoped to this workspace membership. Currently: { nav_hidden?: string[] } — sidebar item keys hidden for this student, overriding the workspace default. Absent/null means "use the workspace default".';

-- Students can read their own workspace_students row (needed for the per-student nav override).
CREATE POLICY "Students can view own workspace_students"
  ON public.workspace_students FOR SELECT
  USING (student_id = auth.uid());

-- No UPDATE policy existed on workspace_students at all before this — owners need one
-- to write nav overrides (and any future per-student setting stored the same way).
CREATE POLICY "Owners can update workspace_students"
  ON public.workspace_students FOR UPDATE
  USING (public.is_workspace_owner(workspace_id))
  WITH CHECK (public.is_workspace_owner(workspace_id));

-- Students could not read `workspaces` at all before this — needed for the workspace-wide
-- nav default. Mirrors the existing tutor member-read policy shape; exposes the same jsonb
-- settings blob tutors already see (currency, timezone, nav defaults — nothing sensitive).
CREATE POLICY "Students can view their workspace"
  ON public.workspaces FOR SELECT
  USING (id IN (SELECT workspace_id FROM public.workspace_students WHERE student_id = auth.uid()));

-- Students can view profiles of tutors in their 1v1 rooms — the mirror of the existing
-- "Tutors can view profiles of students in their 1v1 rooms" policy. The client-side query
-- (useOneToOneRooms.ts) already restricts the selected columns to user_id/display_name/
-- avatar_url; this policy only permits the row to be read at all.
CREATE POLICY "Students can view profiles of tutors in their 1v1 rooms"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.one_to_one_rooms o
      WHERE o.tutor_id = profiles.user_id AND o.student_id = auth.uid()
    )
  );
