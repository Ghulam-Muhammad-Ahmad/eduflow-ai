-- AI Credit monthly renewal: run on 1st of each month to reset/create credit pools for all active subscriptions.
-- Ensures credits are available even before first use of the month. Credit allocation amounts
-- are set by the application via ensureOwnerWorkspaceCreditPool() on first use, but this
-- migration ensures the pool exists by month-end (worst case: first use of next month).

-- =============================================================================
-- 1. Postgres function (idempotent)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.ai_credit_renewal_monthly()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  period_date date;
  ws record;
BEGIN
  period_date := date_trunc('month', now())::date;

  -- Only run on the 1st of the month (optional guard if cron runs daily)
  IF date_trunc('day', now())::date <> period_date THEN
    RETURN;
  END IF;

  -- For each workspace with an active/trialing subscription, ensure a credit pool placeholder exists for this month.
  -- The actual credit_allocated amount will be set by the application (ensureOwnerWorkspaceCreditPool)
  -- based on the subscription plan. This ensures the pool structure exists even if not yet populated.
  FOR ws IN
    SELECT DISTINCT w.id as workspace_id
    FROM public.workspaces w
    INNER JOIN public.workspace_subscriptions ws
      ON ws.workspace_id = w.id
      AND ws.status IN ('active', 'trialing')
  LOOP
    -- Insert placeholder pool if not exists. Application will populate credits_allocated on first use.
    INSERT INTO public.workspace_credit_pools (workspace_id, period, credits_allocated, credits_assigned_out, credits_used_direct)
    VALUES (ws.workspace_id, period_date, 0, 0, 0)
    ON CONFLICT (workspace_id, period) DO NOTHING;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.ai_credit_renewal_monthly() IS 'Monthly pool initialization: ensures credit pool rows exist for all active subscriptions on 1st of month. Credits populated by ensureOwnerWorkspaceCreditPool() on first use. Runs via pg_cron.';

-- =============================================================================
-- 2. Schedule the job (Supabase Cron / pg_cron)
-- =============================================================================
SELECT cron.schedule(
  'ai-credit-renewal-monthly-1st',
  '0 0 1 * *',
  'SELECT public.ai_credit_renewal_monthly();'
);
