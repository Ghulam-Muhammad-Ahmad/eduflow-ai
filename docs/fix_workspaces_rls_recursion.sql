-- Fix infinite recursion between workspaces and workspace_members RLS policies.
-- Run this in Supabase Dashboard → SQL Editor, or add as a new migration (e.g. 20260301000000_fix_workspaces_rls_recursion.sql).

-- 1. Function: true if current user is owner of the workspace (runs with definer rights, no RLS recursion)
CREATE OR REPLACE FUNCTION public.is_workspace_owner(ws_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = ws_id AND owner_id = auth.uid()
  );
$$;

-- 2. Replace workspace_members SELECT policy to use the function instead of querying workspaces
DROP POLICY IF EXISTS "Users can view workspace members of their workspace" ON public.workspace_members;
CREATE POLICY "Users can view workspace members of their workspace"
  ON public.workspace_members FOR SELECT
  USING (
    public.is_workspace_owner(workspace_id) OR user_id = auth.uid()
  );

-- 3. Replace workspace_members INSERT policy to use the function (owners can add members)
DROP POLICY IF EXISTS "Owners can insert workspace members" ON public.workspace_members;
CREATE POLICY "Owners can insert workspace members"
  ON public.workspace_members FOR INSERT
  WITH CHECK (public.is_workspace_owner(workspace_id));

-- 4. Replace workspace_members UPDATE policy
DROP POLICY IF EXISTS "Owners can update workspace members" ON public.workspace_members;
CREATE POLICY "Owners can update workspace members"
  ON public.workspace_members FOR UPDATE
  USING (public.is_workspace_owner(workspace_id));

-- 5. Replace workspace_members DELETE policy
DROP POLICY IF EXISTS "Owners can delete workspace members" ON public.workspace_members;
CREATE POLICY "Owners can delete workspace members"
  ON public.workspace_members FOR DELETE
  USING (public.is_workspace_owner(workspace_id));

-- Grant execute to authenticated users (for RLS use)
GRANT EXECUTE ON FUNCTION public.is_workspace_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_owner(uuid) TO service_role;
