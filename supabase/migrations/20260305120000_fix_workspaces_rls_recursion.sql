-- Fix infinite recursion in RLS: workspaces <-> workspace_members policies cross-reference each other.
-- Use SECURITY DEFINER helpers so checks run with definer rights and do not re-enter RLS.

-- 1. Helpers (bypass RLS when used from policies)
CREATE OR REPLACE FUNCTION public.is_workspace_owner(_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = _workspace_id AND w.owner_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = _workspace_id AND wm.user_id = auth.uid()
  );
$$;

-- For profiles: can the current user (as workspace owner) view this member's profile?
CREATE OR REPLACE FUNCTION public.owner_can_view_member_profile(_member_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspaces w
    JOIN public.workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = _member_user_id
    WHERE w.owner_id = auth.uid()
  );
$$;

-- For profiles: can the current user (as workspace owner) view this student's profile?
CREATE OR REPLACE FUNCTION public.owner_can_view_student_profile(_student_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tutor_student_assignments tsa
    JOIN public.workspaces w ON w.id = tsa.workspace_id
    WHERE tsa.student_id = _student_user_id AND w.owner_id = auth.uid()
  );
$$;

-- 2. workspaces: use helper instead of querying workspace_members
DROP POLICY IF EXISTS "Workspace members can view workspace" ON public.workspaces;
CREATE POLICY "Workspace members can view workspace"
  ON public.workspaces FOR SELECT
  USING (owner_id = auth.uid() OR public.is_workspace_member(id));

-- 3. workspace_members: use helper instead of querying workspaces
DROP POLICY IF EXISTS "Users can view workspace members of their workspace" ON public.workspace_members;
CREATE POLICY "Users can view workspace members of their workspace"
  ON public.workspace_members FOR SELECT
  USING (public.is_workspace_owner(workspace_id) OR user_id = auth.uid());

DROP POLICY IF EXISTS "Owners can insert workspace members" ON public.workspace_members;
CREATE POLICY "Owners can insert workspace members"
  ON public.workspace_members FOR INSERT
  WITH CHECK (public.is_workspace_owner(workspace_id));

DROP POLICY IF EXISTS "Owners can update workspace members" ON public.workspace_members;
CREATE POLICY "Owners can update workspace members"
  ON public.workspace_members FOR UPDATE
  USING (public.is_workspace_owner(workspace_id));

DROP POLICY IF EXISTS "Owners can delete workspace members" ON public.workspace_members;
CREATE POLICY "Owners can delete workspace members"
  ON public.workspace_members FOR DELETE
  USING (public.is_workspace_owner(workspace_id));

-- 4. workspace_subscriptions: use helpers
DROP POLICY IF EXISTS "Workspace members can view subscription" ON public.workspace_subscriptions;
CREATE POLICY "Workspace members can view subscription"
  ON public.workspace_subscriptions FOR SELECT
  USING (
    public.is_workspace_owner(workspace_subscriptions.workspace_id)
    OR public.is_workspace_member(workspace_subscriptions.workspace_id)
  );

-- 5. tutor_student_assignments: use helper
DROP POLICY IF EXISTS "Owners and tutor can view tutor_student_assignments" ON public.tutor_student_assignments;
CREATE POLICY "Owners and tutor can view tutor_student_assignments"
  ON public.tutor_student_assignments FOR SELECT
  USING (
    tutor_id = auth.uid()
    OR public.is_workspace_owner(workspace_id)
  );

DROP POLICY IF EXISTS "Owners can manage tutor_student_assignments" ON public.tutor_student_assignments;
CREATE POLICY "Owners can manage tutor_student_assignments"
  ON public.tutor_student_assignments FOR ALL
  USING (public.is_workspace_owner(workspace_id))
  WITH CHECK (public.is_workspace_owner(workspace_id));

-- 6. profiles: use helpers so we don't query workspaces from profile policy
DROP POLICY IF EXISTS "Workspace owners can view profiles of workspace members" ON public.profiles;
CREATE POLICY "Workspace owners can view profiles of workspace members"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.owner_can_view_member_profile(profiles.user_id));

DROP POLICY IF EXISTS "Workspace owners can view profiles of assigned students" ON public.profiles;
CREATE POLICY "Workspace owners can view profiles of assigned students"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.owner_can_view_student_profile(profiles.user_id));

-- 7. credit_assignments_audit: use helpers
DROP POLICY IF EXISTS "Workspace owners and members can view credit audit" ON public.credit_assignments_audit;
CREATE POLICY "Workspace owners and members can view credit audit"
  ON public.credit_assignments_audit FOR SELECT
  USING (
    public.is_workspace_owner(workspace_id)
    OR public.is_workspace_member(workspace_id)
  );

-- 8. workspace_credit_pools: use helpers
DROP POLICY IF EXISTS "Workspace members can view workspace credit pool" ON public.workspace_credit_pools;
CREATE POLICY "Workspace members can view workspace credit pool"
  ON public.workspace_credit_pools FOR SELECT
  USING (
    public.is_workspace_member(workspace_credit_pools.workspace_id)
    OR public.is_workspace_owner(workspace_credit_pools.workspace_id)
  );
