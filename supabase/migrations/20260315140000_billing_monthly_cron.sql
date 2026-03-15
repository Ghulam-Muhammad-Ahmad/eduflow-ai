-- Billing monthly cron: run on 1st of each month to create monthly salary earning rows and monthly fee invoice rows.
-- Aligns with .cursor/plans/billing_and_payout_system_2eda32b8.plan.md §4.

-- =============================================================================
-- 1. Postgres function (idempotent)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.billing_run_monthly_billing()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  period_date date;
  month_label text;
  c record;
  fee_c record;
  gross numeric;
  platform_fee_pct numeric;
  platform_fee_amt numeric;
  net_amt numeric;
  existing_earning boolean;
  existing_invoice boolean;
BEGIN
  period_date := date_trunc('month', now())::date;
  month_label := to_char(period_date, 'Month YYYY');

  -- Only run on the 1st of the month (optional guard if cron runs daily)
  IF date_trunc('day', now())::date <> period_date THEN
    RETURN;
  END IF;

  -- Monthly salary: one tutor_earning_rows per active fixed_monthly contract
  FOR c IN
    SELECT tc.id, tc.workspace_id, tc.tutor_id, tc.rate_amount, tc.rate_currency, tc.platform_fee_pct
    FROM tutor_contracts tc
    WHERE tc.status = 'active'
      AND tc.contract_type = 'fixed_monthly'
      AND tc.start_date <= period_date
      AND (tc.end_date IS NULL OR tc.end_date >= period_date)
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM tutor_earning_rows er
      WHERE er.workspace_id = c.workspace_id
        AND er.tutor_id = c.tutor_id
        AND er.period_date = period_date
        AND er.earning_type = 'monthly_salary'
    ) INTO existing_earning;
    IF NOT existing_earning THEN
      gross := round((c.rate_amount)::numeric, 2);
      platform_fee_pct := coalesce(c.platform_fee_pct, 0);
      platform_fee_amt := round(gross * (platform_fee_pct / 100), 2);
      net_amt := round(gross - platform_fee_amt, 2);
      INSERT INTO tutor_earning_rows (
        workspace_id, tutor_id, tutor_contract_id, session_id,
        earning_type, period_date, description,
        gross_amount, platform_fee_amount, net_amount, currency, status
      ) VALUES (
        c.workspace_id, c.tutor_id, c.id, NULL,
        'monthly_salary', period_date, 'Monthly salary – ' || month_label,
        gross, platform_fee_amt, net_amt, coalesce(trim(c.rate_currency), 'GBP'), 'pending'
      );
    END IF;
  END LOOP;

  -- Monthly fee: one student_invoice_rows per active monthly_fixed fee config
  FOR fee_c IN
    SELECT sfc.id, sfc.workspace_id, sfc.student_id, sfc.amount, sfc.currency, sfc.description
    FROM student_fee_configs sfc
    WHERE sfc.active = true
      AND sfc.fee_type = 'monthly_fixed'
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM student_invoice_rows sir
      WHERE sir.student_id = fee_c.student_id
        AND sir.fee_config_id = fee_c.id
        AND sir.invoice_type = 'monthly_fee'
        AND sir.due_date = period_date
    ) INTO existing_invoice;
    IF NOT existing_invoice AND fee_c.amount > 0 THEN
      INSERT INTO student_invoice_rows (
        workspace_id, student_id, fee_config_id, session_id,
        invoice_type, description, amount, currency, due_date, status
      ) VALUES (
        fee_c.workspace_id, fee_c.student_id, fee_c.id, NULL,
        'monthly_fee',
        coalesce(fee_c.description, 'Monthly fee – ' || month_label),
        round((fee_c.amount)::numeric, 2),
        coalesce(trim(fee_c.currency), 'GBP'),
        period_date,
        'unpaid'
      );
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.billing_run_monthly_billing() IS 'Idempotent monthly billing: creates tutor_earning_rows (fixed_monthly) and student_invoice_rows (monthly_fixed). Run on 1st of month via pg_cron.';

-- =============================================================================
-- 2. Schedule the job (Supabase Cron / pg_cron)
-- =============================================================================
SELECT cron.schedule(
  'billing-monthly-1st',
  '0 0 1 * *',
  'SELECT public.billing_run_monthly_billing();'
);
