CREATE POLICY "Workspace owners can view profiles of workspace members"
ON public.profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.workspaces w
    JOIN public.workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = profiles.user_id
    WHERE w.owner_id = auth.uid()
  )
);