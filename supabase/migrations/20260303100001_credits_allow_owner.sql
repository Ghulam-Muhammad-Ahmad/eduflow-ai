-- Allow workspace owner (not just workspace_members) to assign/update credits.

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

  SELECT wcp.credits_allocated, wcp.credits_assigned_out, wcp.id
  INTO pool
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
  WHERE uca.user_id = _member_user_id AND uca.period = _period
    AND uca.source_type = 'workspace' AND uca.source_id = _workspace_id;

  IF current_limit > 0 THEN
    UPDATE public.user_credit_allocations
    SET credits_limit = credits_limit + _credits, updated_at = now()
    WHERE user_id = _member_user_id AND period = _period AND source_type = 'workspace' AND source_id = _workspace_id;
  ELSE
    INSERT INTO public.user_credit_allocations (user_id, period, source_type, source_id, credits_limit, credits_used)
    VALUES (_member_user_id, _period, 'workspace', _workspace_id, _credits, 0);
  END IF;

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

  SELECT credits_limit, credits_used INTO alloc
  FROM public.user_credit_allocations
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
    FROM public.workspace_credit_pools wcp
    WHERE wcp.workspace_id = _workspace_id AND wcp.period = _period;
    IF pool.credits_allocated - pool.credits_assigned_out < delta THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Insufficient credits in workspace pool');
    END IF;
    UPDATE public.workspace_credit_pools
    SET credits_assigned_out = credits_assigned_out + delta, updated_at = now()
    WHERE workspace_id = _workspace_id AND period = _period;
  ELSIF delta < 0 THEN
    UPDATE public.workspace_credit_pools
    SET credits_assigned_out = greatest(0, credits_assigned_out + delta), updated_at = now()
    WHERE workspace_id = _workspace_id AND period = _period;
  END IF;

  UPDATE public.user_credit_allocations
  SET credits_limit = _new_limit, updated_at = now()
  WHERE user_id = _member_user_id AND period = _period AND source_type = 'workspace' AND source_id = _workspace_id;

  RETURN jsonb_build_object('ok', true, 'new_limit', _new_limit);
END;
$$;
