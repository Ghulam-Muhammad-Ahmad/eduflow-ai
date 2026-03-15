-- Allow owners to view profiles of students in their workspace (workspace_students),
-- not only students who have tutor_student_assignments. This fixes the case where
-- the owner creates a student but has not yet assigned them to a tutor/classroom.
CREATE OR REPLACE FUNCTION public.owner_can_view_student_profile(_student_user_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    -- Student is in workspace_students for a workspace owned by current user
    SELECT 1
    FROM public.workspace_students ws
    JOIN public.workspaces w ON w.id = ws.workspace_id
    WHERE ws.student_id = _student_user_id AND w.owner_id = auth.uid()
  )
  OR EXISTS (
    -- Or student has tutor_student_assignment in a workspace owned by current user (existing behavior)
    SELECT 1
    FROM public.tutor_student_assignments tsa
    JOIN public.workspaces w ON w.id = tsa.workspace_id
    WHERE tsa.student_id = _student_user_id AND w.owner_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.owner_can_view_student_profile(uuid) IS
  'True if current user is workspace owner and the student is in workspace_students or tutor_student_assignments for that workspace.';
