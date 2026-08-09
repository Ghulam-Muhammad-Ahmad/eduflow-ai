-- Owner-run AI gateway health check.
--
--   1. `model_test` becomes a valid ai_interactions.interaction_type so the
--      credit deduction for a test run can be recorded like any other AI use.
--   2. check_and_deduct_credits still wrote provider = 'openai' on every row it
--      inserted, left over from before the move to the OpenCode gateway. All AI
--      now runs through OpenCode, so the recorded provider was simply wrong.

-- ── 1. Allow the new interaction type ───────────────────────────────────────────
ALTER TABLE public.ai_interactions
  DROP CONSTRAINT IF EXISTS ai_interactions_interaction_type_check;

ALTER TABLE public.ai_interactions
  ADD CONSTRAINT ai_interactions_interaction_type_check CHECK (
    interaction_type = ANY (ARRAY[
      'content_generation'::text,
      'grading'::text,
      'lesson_planning'::text,
      'study_materials'::text,
      'rubric_generation'::text,
      'quiz_questions'::text,
      'differentiation'::text,
      'concept_explanation'::text,
      'practice_questions'::text,
      'flashcards'::text,
      'study_plan'::text,
      'worksheet_generation'::text,
      'paper_generation'::text,
      'checker'::text,
      'contract_generation'::text,
      'contract_revision'::text,
      'teacher_test_generation'::text,
      'teacher_evaluation'::text,
      'tutor_matching'::text,
      'model_test'::text
    ])
  );

-- ── 2. Record the real provider ─────────────────────────────────────────────────
-- Body is unchanged apart from the two provider literals.
CREATE OR REPLACE FUNCTION public.check_and_deduct_credits(
  _user_id uuid,
  _task_type text,
  _credit_cost integer,
  _interaction_id uuid DEFAULT NULL::uuid
) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
    VALUES (_user_id, _task_type, _credit_cost, true, 'opencode', '', 0, 0, null);
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
  VALUES (_user_id, _task_type, _credit_cost, true, 'opencode', '', 0, 0, null);

  RETURN jsonb_build_object('ok', true, 'remaining', pool_rem - _credit_cost, 'deducted', _credit_cost);
END;
$$;
