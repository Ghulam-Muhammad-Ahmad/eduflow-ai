-- Allow workspace owners to update their workspace (e.g. name, settings).
CREATE POLICY "Owners can update their workspace"
  ON public.workspaces FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
