-- Ensure owner's remaining credits reflect pool deduction when assigning to tutor/student.
-- 1) get_credit_context: prefer workspace the user OWNS so owner sees their pool (which decreases on assign).
-- 2) assign_credits_to_member already deducts via credits_assigned_out; no change needed.

-- get_credit_context: use owned workspace first for pool lookup so owners see correct remaining
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
    -- Prefer workspace the user OWNS so owner's "remaining" reflects pool after assigning to tutor/student
    SELECT w.id INTO ws_id FROM public.workspaces w WHERE w.owner_id = _user_id LIMIT 1;
    IF ws_id IS NULL THEN
      SELECT wm.workspace_id INTO ws_id
      FROM public.workspace_members wm
      WHERE wm.user_id = _user_id
      LIMIT 1;
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
