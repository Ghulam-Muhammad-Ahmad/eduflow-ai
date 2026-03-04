CREATE POLICY "Workspace owners can view profiles of assigned students"
ON public.profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tutor_student_assignments tsa
    JOIN public.workspaces w ON w.id = tsa.workspace_id
    WHERE tsa.student_id = profiles.user_id
      AND w.owner_id = auth.uid()
  )
);