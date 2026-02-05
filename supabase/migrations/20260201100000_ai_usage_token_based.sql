-- =============================================
-- AI USAGE: TOKEN-BASED CREDITS
-- Credits are calculated from input + output tokens per request,
-- not 1 call = 1 credit. Limits are in tokens per month.
-- =============================================

-- 1. Update existing usage_limit from request-count to token-count
--    (200 -> 200000, 100 -> 100000, 10 -> 10000)
UPDATE public.user_ai_usage
SET usage_limit = CASE
  WHEN usage_limit = 200 THEN 200000
  WHEN usage_limit = 100 THEN 100000
  WHEN usage_limit = 10 THEN 10000
  ELSE COALESCE(usage_limit, 10000)
END
WHERE usage_limit IS NOT NULL AND usage_limit < 1000;

-- 2. can_make_ai_request: check and return token-based usage
CREATE OR REPLACE FUNCTION public.can_make_ai_request(_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  usage_record public.user_ai_usage;
  remaining_tokens INTEGER;
BEGIN
  SELECT * INTO usage_record
  FROM public.get_or_create_ai_usage(_user_id);

  remaining_tokens := GREATEST(0, COALESCE(usage_record.usage_limit, 0) - usage_record.tokens_used);

  -- Limit is based on tokens_used >= usage_limit (tokens per month)
  IF usage_record.limit_reached OR
     (usage_record.usage_limit IS NOT NULL AND usage_record.tokens_used >= usage_record.usage_limit) THEN
    RETURN jsonb_build_object(
      'can_request', false,
      'reason', 'Monthly AI token limit reached',
      'current_usage', usage_record.tokens_used,
      'limit', usage_record.usage_limit,
      'remaining', 0
    );
  END IF;

  RETURN jsonb_build_object(
    'can_request', true,
    'current_usage', usage_record.tokens_used,
    'limit', usage_record.usage_limit,
    'remaining', remaining_tokens
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. get_or_create_ai_usage: default limits in tokens per month
CREATE OR REPLACE FUNCTION public.get_or_create_ai_usage(
  _user_id UUID,
  _month DATE DEFAULT date_trunc('month', CURRENT_DATE)::DATE
)
RETURNS public.user_ai_usage AS $$
DECLARE
  usage_record public.user_ai_usage;
  user_role app_role;
  usage_limit INTEGER;
BEGIN
  SELECT role INTO user_role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1;

  -- Token limits per month (not request count)
  usage_limit := CASE
    WHEN user_role = 'teacher' THEN 200000   -- 200k tokens
    WHEN user_role = 'student' THEN 100000   -- 100k tokens
    ELSE 10000                               -- 10k tokens free tier
  END;

  SELECT * INTO usage_record
  FROM public.user_ai_usage
  WHERE user_id = _user_id
  AND month = _month;

  IF usage_record IS NULL THEN
    INSERT INTO public.user_ai_usage (user_id, month, usage_limit)
    VALUES (_user_id, _month, usage_limit)
    RETURNING * INTO usage_record;
  END IF;

  RETURN usage_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. record_ai_interaction: add tokens to tokens_used, set limit_reached by tokens
CREATE OR REPLACE FUNCTION public.record_ai_interaction(
  _user_id UUID,
  _interaction_type TEXT,
  _provider TEXT,
  _model TEXT,
  _tokens_used INTEGER DEFAULT 0,
  _cost DECIMAL DEFAULT 0,
  _success BOOLEAN DEFAULT true,
  _error_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  interaction_id UUID;
  usage_record public.user_ai_usage;
  new_tokens_total INTEGER;
BEGIN
  INSERT INTO public.ai_interactions (
    user_id,
    interaction_type,
    provider,
    model,
    tokens_used,
    cost,
    success,
    error_message
  )
  VALUES (
    _user_id,
    _interaction_type,
    _provider,
    _model,
    _tokens_used,
    _cost,
    _success,
    _error_message
  )
  RETURNING id INTO interaction_id;

  IF _success THEN
    SELECT * INTO usage_record
    FROM public.get_or_create_ai_usage(_user_id);

    new_tokens_total := usage_record.tokens_used + _tokens_used;

    UPDATE public.user_ai_usage
    SET
      interactions_count = interactions_count + 1,
      tokens_used = tokens_used + _tokens_used,
      cost = cost + _cost,
      limit_reached = CASE
        WHEN usage_limit IS NOT NULL AND new_tokens_total >= usage_limit
        THEN true
        ELSE limit_reached
      END,
      updated_at = now()
    WHERE id = usage_record.id;
  END IF;

  RETURN interaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
