-- Credit assignment audit and ensure workspace pool exists so deduction is always consistent.

CREATE TABLE IF NOT EXISTS public.credit_assignments_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  period date NOT NULL,
  assigned_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_to_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credits integer NOT NULL,
  action text NOT NULL CHECK (action IN ('assign', 'update')),
  previous_limit integer,
  new_limit integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_assignments_audit_workspace_period ON public.credit_assignments_audit(workspace_id, period);
CREATE INDEX IF NOT EXISTS idx_credit_assignments_audit_assigned_to ON public.credit_assignments_audit(assigned_to_user_id, created_at);
ALTER TABLE public.credit_assignments_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace owners and members can view credit audit" ON public.credit_assignments_audit FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid())
     OR EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = credit_assignments_audit.workspace_id AND wm.user_id = auth.uid()));

-- assign_credits_to_member: ensure pool exists, deduct from pool, allocate to member, record audit.
CREATE OR REPLACE FUNCTION public.assign_credits_to_member(
  _workspace_id uuid,
  _member_user_id uuid,
  _credits integer,
  _caller_user_id uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _period date := date_trunc('month', current_date)::date;
  pool record;
  is_caller_owner_or_tutor boolean := false;
  current_limit integer := 0;
BEGIN
  IF _credits IS NULL OR _credits <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Credits must be positive');
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = _workspace_id AND w.owner_id = _caller_user_id)
    OR EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = _workspace_id AND wm.user_id = _caller_user_id)
  INTO is_caller_owner_or_tutor;
  IF NOT is_caller_owner_or_tutor THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not a workspace owner or member');
  END IF;

  INSERT INTO public.workspace_credit_pools (workspace_id, period, credits_allocated, credits_assigned_out, credits_used_direct)
  VALUES (_workspace_id, _period, 0, 0, 0)
  ON CONFLICT (workspace_id, period) DO NOTHING;

  SELECT wcp.credits_allocated, wcp.credits_assigned_out, wcp.id INTO pool
  FROM public.workspace_credit_pools wcp
  WHERE wcp.workspace_id = _workspace_id AND wcp.period = _period;

  IF pool.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No credit pool for this workspace this period');
  END IF;

  IF (pool.credits_allocated - pool.credits_assigned_out) < _credits THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Insufficient credits in workspace pool');
  END IF;

  UPDATE public.workspace_credit_pools
  SET credits_assigned_out = credits_assigned_out + _credits, updated_at = now()
  WHERE workspace_id = _workspace_id AND period = _period;

  SELECT coalesce(uca.credits_limit, 0) INTO current_limit
  FROM public.user_credit_allocations uca
  WHERE uca.user_id = _member_user_id AND uca.period = _period AND uca.source_type = 'workspace' AND uca.source_id = _workspace_id;

  IF current_limit > 0 THEN
    UPDATE public.user_credit_allocations SET credits_limit = credits_limit + _credits, updated_at = now()
    WHERE user_id = _member_user_id AND period = _period AND source_type = 'workspace' AND source_id = _workspace_id;
  ELSE
    INSERT INTO public.user_credit_allocations (user_id, period, source_type, source_id, credits_limit, credits_used)
    VALUES (_member_user_id, _period, 'workspace', _workspace_id, _credits, 0);
  END IF;

  INSERT INTO public.credit_assignments_audit (workspace_id, period, assigned_by_user_id, assigned_to_user_id, credits, action, new_limit)
  VALUES (_workspace_id, _period, _caller_user_id, _member_user_id, _credits, 'assign', current_limit + _credits);

  RETURN jsonb_build_object('ok', true, 'assigned', _credits);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_assigned_credits(
  _workspace_id uuid,
  _member_user_id uuid,
  _new_limit integer,
  _caller_user_id uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _period date := date_trunc('month', current_date)::date;
  pool record;
  is_caller_owner_or_tutor boolean := false;
  alloc record;
  delta integer;
BEGIN
  IF _new_limit IS NULL OR _new_limit < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid new limit');
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = _workspace_id AND w.owner_id = _caller_user_id)
    OR EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = _workspace_id AND wm.user_id = _caller_user_id)
  INTO is_caller_owner_or_tutor;
  IF NOT is_caller_owner_or_tutor THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not a workspace owner or member');
  END IF;

  SELECT credits_limit, credits_used INTO alloc FROM public.user_credit_allocations
  WHERE user_id = _member_user_id AND period = _period AND source_type = 'workspace' AND source_id = _workspace_id;

  IF alloc.credits_limit IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No allocation for this member');
  END IF;

  IF _new_limit < alloc.credits_used THEN
    RETURN jsonb_build_object('ok', false, 'error', 'New limit cannot be less than already used');
  END IF;

  delta := _new_limit - alloc.credits_limit;

  IF delta > 0 THEN
    SELECT wcp.credits_allocated, wcp.credits_assigned_out INTO pool
    FROM public.workspace_credit_pools wcp WHERE wcp.workspace_id = _workspace_id AND wcp.period = _period;
    IF pool.credits_allocated IS NOT NULL AND (pool.credits_allocated - pool.credits_assigned_out) < delta THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Insufficient credits in workspace pool');
    END IF;
    UPDATE public.workspace_credit_pools SET credits_assigned_out = credits_assigned_out + delta, updated_at = now()
    WHERE workspace_id = _workspace_id AND period = _period;
  ELSIF delta < 0 THEN
    UPDATE public.workspace_credit_pools SET credits_assigned_out = greatest(0, credits_assigned_out + delta), updated_at = now()
    WHERE workspace_id = _workspace_id AND period = _period;
  END IF;

  UPDATE public.user_credit_allocations SET credits_limit = _new_limit, updated_at = now()
  WHERE user_id = _member_user_id AND period = _period AND source_type = 'workspace' AND source_id = _workspace_id;

  INSERT INTO public.credit_assignments_audit (workspace_id, period, assigned_by_user_id, assigned_to_user_id, credits, action, previous_limit, new_limit)
  VALUES (_workspace_id, _period, _caller_user_id, _member_user_id, abs(delta), 'update', alloc.credits_limit, _new_limit);

  RETURN jsonb_build_object('ok', true, 'new_limit', _new_limit);
END;
$$;
