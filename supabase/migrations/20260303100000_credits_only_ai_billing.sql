-- Credits-only AI billing: workspace pools, user allocations, check-and-deduct, assign/edit.
-- Period = first day of month (date).

CREATE TABLE IF NOT EXISTS public.workspace_credit_pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  period date NOT NULL,
  credits_allocated integer NOT NULL DEFAULT 0,
  credits_assigned_out integer NOT NULL DEFAULT 0,
  credits_used_direct integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, period)
);

CREATE INDEX IF NOT EXISTS idx_workspace_credit_pools_workspace_period
  ON public.workspace_credit_pools(workspace_id, period);

ALTER TABLE public.workspace_credit_pools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view workspace credit pool"
  ON public.workspace_credit_pools FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_credit_pools.workspace_id
        AND wm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_credit_pools.workspace_id AND w.owner_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS public.user_credit_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period date NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('subscription', 'workspace')),
  source_id uuid NOT NULL,
  credits_limit integer NOT NULL DEFAULT 0,
  credits_used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, period, source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_user_credit_allocations_user_period
  ON public.user_credit_allocations(user_id, period);

ALTER TABLE public.user_credit_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credit allocations"
  ON public.user_credit_allocations FOR SELECT
  USING (user_id = auth.uid());

-- Add credits_deducted to ai_interactions for audit
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ai_interactions' AND column_name = 'credits_deducted'
  ) THEN
    ALTER TABLE public.ai_interactions ADD COLUMN credits_deducted integer DEFAULT 0;
  END IF;
END $$;

-- get_credit_context: returns effective credits_limit, credits_used, remaining for a user
CREATE OR REPLACE FUNCTION public.get_credit_context(_user_id uuid)
RETURNS TABLE (
  credits_limit integer,
  credits_used integer,
  remaining integer,
  source_type text,
  source_id uuid
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _period date := date_trunc('month', current_date)::date;
  total_limit integer := 0;
  total_used integer := 0;
  ws_id uuid;
  pool_rem integer;
BEGIN
  SELECT coalesce(sum(uca.credits_limit), 0), coalesce(sum(uca.credits_used), 0)
  INTO total_limit, total_used
  FROM public.user_credit_allocations uca
  WHERE uca.user_id = _user_id AND uca.period = _period;

  IF total_limit = 0 AND total_used = 0 THEN
    SELECT wm.workspace_id INTO ws_id
    FROM public.workspace_members wm
    WHERE wm.user_id = _user_id
    LIMIT 1;
    IF ws_id IS NULL THEN
      SELECT w.id INTO ws_id FROM public.workspaces w WHERE w.owner_id = _user_id LIMIT 1;
    END IF;
    IF ws_id IS NOT NULL THEN
      SELECT (wcp.credits_allocated - wcp.credits_assigned_out - wcp.credits_used_direct) INTO pool_rem
      FROM public.workspace_credit_pools wcp
      WHERE wcp.workspace_id = ws_id AND wcp.period = _period;
      IF pool_rem IS NOT NULL AND pool_rem > 0 THEN
        total_limit := (SELECT wcp.credits_allocated - wcp.credits_assigned_out FROM public.workspace_credit_pools wcp WHERE wcp.workspace_id = ws_id AND wcp.period = _period);
        total_used := (SELECT wcp.credits_used_direct FROM public.workspace_credit_pools wcp WHERE wcp.workspace_id = ws_id AND wcp.period = _period);
        source_type := 'workspace';
        source_id := ws_id;
      END IF;
    END IF;
  END IF;

  credits_limit := total_limit;
  credits_used := total_used;
  remaining := greatest(0, total_limit - total_used);
  RETURN NEXT;
  RETURN;
END;
$$;

-- check_and_deduct_credits: deduct from user allocations or workspace pool before AI call
CREATE OR REPLACE FUNCTION public.check_and_deduct_credits(
  _user_id uuid,
  _task_type text,
  _credit_cost integer,
  _interaction_id uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _period date := date_trunc('month', current_date)::date;
  total_remaining integer := 0;
  to_deduct integer := _credit_cost;
  alloc record;
  new_used integer;
  ws_id uuid;
  pool_rem integer;
BEGIN
  IF _credit_cost IS NULL OR _credit_cost <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'remaining', 0, 'deducted', 0);
  END IF;

  SELECT coalesce(sum(uca.credits_limit - uca.credits_used), 0) INTO total_remaining
  FROM public.user_credit_allocations uca
  WHERE uca.user_id = _user_id AND uca.period = _period;

  IF total_remaining >= _credit_cost THEN
    FOR alloc IN
      SELECT id, credits_limit, credits_used
      FROM public.user_credit_allocations
      WHERE user_id = _user_id AND period = _period
      ORDER BY id
    LOOP
      EXIT WHEN to_deduct <= 0;
      new_used := alloc.credits_used + least(to_deduct, alloc.credits_limit - alloc.credits_used);
      to_deduct := to_deduct - (new_used - alloc.credits_used);
      UPDATE public.user_credit_allocations
      SET credits_used = new_used, updated_at = now()
      WHERE id = alloc.id;
    END LOOP;
    INSERT INTO public.ai_interactions (user_id, interaction_type, credits_deducted, success, provider, model, tokens_used, cost, error_message)
    VALUES (_user_id, _task_type, _credit_cost, true, 'openai', '', 0, 0, null);
    RETURN jsonb_build_object('ok', true, 'remaining', total_remaining - _credit_cost, 'deducted', _credit_cost);
  END IF;

  SELECT wm.workspace_id INTO ws_id
  FROM public.workspace_members wm
  WHERE wm.user_id = _user_id
  LIMIT 1;
  IF ws_id IS NULL THEN
    SELECT w.id INTO ws_id FROM public.workspaces w WHERE w.owner_id = _user_id LIMIT 1;
  END IF;
  IF ws_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Insufficient credits', 'remaining', coalesce(total_remaining, 0), 'required', _credit_cost);
  END IF;

  SELECT (wcp.credits_allocated - wcp.credits_assigned_out - wcp.credits_used_direct) INTO pool_rem
  FROM public.workspace_credit_pools wcp
  WHERE wcp.workspace_id = ws_id AND wcp.period = _period;

  IF pool_rem IS NULL OR pool_rem < _credit_cost THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Insufficient credits', 'remaining', coalesce(pool_rem, 0), 'required', _credit_cost);
  END IF;

  UPDATE public.workspace_credit_pools
  SET credits_used_direct = credits_used_direct + _credit_cost, updated_at = now()
  WHERE workspace_id = ws_id AND period = _period;

  INSERT INTO public.ai_interactions (user_id, interaction_type, credits_deducted, success, provider, model, tokens_used, cost, error_message)
  VALUES (_user_id, _task_type, _credit_cost, true, 'openai', '', 0, 0, null);

  RETURN jsonb_build_object('ok', true, 'remaining', pool_rem - _credit_cost, 'deducted', _credit_cost);
END;
$$;

-- assign_credits_to_member: owner or tutor assigns credits from workspace pool to member
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

-- update_assigned_credits: change member's assigned limit; increase = deduct from pool, decrease = add back
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

-- upsert_workspace_credit_pool: called by Paddle webhook to set credits_allocated for workspace/period
CREATE OR REPLACE FUNCTION public.upsert_workspace_credit_pool(
  _workspace_id uuid,
  _period date,
  _credits_allocated integer
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.workspace_credit_pools (workspace_id, period, credits_allocated, credits_assigned_out, credits_used_direct)
  VALUES (_workspace_id, _period, _credits_allocated, 0, 0)
  ON CONFLICT (workspace_id, period)
  DO UPDATE SET credits_allocated = _credits_allocated, updated_at = now();
END;
$$;

-- upsert_user_credit_allocation_subscription: for user-level subscription (e.g. student plan)
CREATE OR REPLACE FUNCTION public.upsert_user_credit_allocation_subscription(
  _user_id uuid,
  _period date,
  _credits_limit integer
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_credit_allocations (user_id, period, source_type, source_id, credits_limit, credits_used)
  VALUES (_user_id, _period, 'subscription', _user_id, _credits_limit, 0)
  ON CONFLICT (user_id, period, source_type, source_id)
  DO UPDATE SET credits_limit = _credits_limit, updated_at = now();
END;
$$;
