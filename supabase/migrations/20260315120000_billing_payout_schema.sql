-- Billing & Payout System — Sprint 1: Database schema, storage, RLS
-- Project: zmsdstxpnausakmxqhbo. Aligns with .cursor/plans/billing_and_payout_system_2eda32b8.plan.md

-- =============================================================================
-- 1. Evolve tutor_contracts (new columns for outline: contract_type, status, dates, platform_fee_pct)
-- =============================================================================

-- Add new columns (keep legacy contract_status and pay_type for backward compatibility)
ALTER TABLE public.tutor_contracts
  ADD COLUMN IF NOT EXISTS contract_type text DEFAULT 'hourly'
    CHECK (contract_type IN ('fixed_monthly', 'per_session', 'hourly')),
  ADD COLUMN IF NOT EXISTS platform_fee_pct numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS start_date date DEFAULT current_date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'ended'));

-- Backfill contract_type from pay_type for existing rows
UPDATE public.tutor_contracts
SET contract_type = pay_type
WHERE pay_type IN ('hourly', 'per_session');

-- Backfill status: all existing contracts treated as active
UPDATE public.tutor_contracts SET status = 'active' WHERE status IS NULL;

COMMENT ON COLUMN public.tutor_contracts.contract_type IS 'Billing outline: fixed_monthly | per_session | hourly';
COMMENT ON COLUMN public.tutor_contracts.platform_fee_pct IS 'Platform fee percentage applied to gross (e.g. for per_session/hourly)';
COMMENT ON COLUMN public.tutor_contracts.start_date IS 'Contract effective start date';
COMMENT ON COLUMN public.tutor_contracts.end_date IS 'Contract end date; null = ongoing';
COMMENT ON COLUMN public.tutor_contracts.status IS 'Billing outline: active | paused | ended';

-- Allow multiple contracts per tutor (e.g. one ended, one active); enforce at most one active per (workspace_id, tutor_id)
ALTER TABLE public.tutor_contracts DROP CONSTRAINT IF EXISTS tutor_contracts_workspace_id_tutor_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tutor_contracts_one_active_per_tutor
  ON public.tutor_contracts (workspace_id, tutor_id) WHERE (status = 'active');

-- =============================================================================
-- 2. sessions: add completed_by_user_id for audit
-- =============================================================================
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS completed_by_user_id uuid REFERENCES auth.users(id);

COMMENT ON COLUMN public.sessions.completed_by_user_id IS 'User (tutor or owner) who marked the session complete; for audit.';

-- =============================================================================
-- 3. New tables: tutor_earning_rows, student_fee_configs, student_invoice_rows, tutor_payouts
-- =============================================================================

-- tutor_payouts first (referenced by tutor_earning_rows)
CREATE TABLE IF NOT EXISTS public.tutor_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  tutor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_net_amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GBP',
  payment_note text,
  proof_storage_path text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tutor_payouts_workspace_id ON public.tutor_payouts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tutor_payouts_tutor_id ON public.tutor_payouts(tutor_id);

COMMENT ON TABLE public.tutor_payouts IS 'Owner-created payouts to tutors; proof uploaded to payment-proofs bucket.';

-- tutor_earning_rows
CREATE TABLE IF NOT EXISTS public.tutor_earning_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  tutor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tutor_contract_id uuid REFERENCES public.tutor_contracts(id) ON DELETE SET NULL,
  session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  earning_type text NOT NULL CHECK (earning_type IN ('session', 'monthly_salary')),
  period_date date NOT NULL,
  description text,
  gross_amount numeric(12,2) NOT NULL DEFAULT 0,
  platform_fee_amount numeric(12,2) NOT NULL DEFAULT 0,
  net_amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GBP',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid')),
  payout_id uuid REFERENCES public.tutor_payouts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tutor_earning_rows_workspace_status ON public.tutor_earning_rows(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_tutor_earning_rows_tutor_status ON public.tutor_earning_rows(tutor_id, status);
CREATE INDEX IF NOT EXISTS idx_tutor_earning_rows_payout_id ON public.tutor_earning_rows(payout_id);
CREATE INDEX IF NOT EXISTS idx_tutor_earning_rows_session_id ON public.tutor_earning_rows(session_id);

COMMENT ON TABLE public.tutor_earning_rows IS 'Per-session or monthly salary earning rows; linked to contract and optionally payout.';

-- student_fee_configs
CREATE TABLE IF NOT EXISTS public.student_fee_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fee_type text NOT NULL CHECK (fee_type IN ('monthly_fixed', 'per_session', 'per_hour')),
  amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GBP',
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, student_id, fee_type)
);

CREATE INDEX IF NOT EXISTS idx_student_fee_configs_workspace_student ON public.student_fee_configs(workspace_id, student_id);

COMMENT ON TABLE public.student_fee_configs IS 'Per-student fee setup: monthly fixed, per session, or per hour.';

-- student_invoice_rows
CREATE TABLE IF NOT EXISTS public.student_invoice_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fee_config_id uuid REFERENCES public.student_fee_configs(id) ON DELETE SET NULL,
  session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  invoice_type text NOT NULL CHECK (invoice_type IN ('monthly_fee', 'session_fee', 'manual_fine')),
  description text,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GBP',
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'unpaid'
    CHECK (status IN ('unpaid', 'proof_submitted', 'paid', 'waived')),
  paid_at timestamptz,
  proof_storage_path text,
  proof_submitted_at timestamptz,
  waived_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_invoice_rows_workspace_student ON public.student_invoice_rows(workspace_id, student_id);
CREATE INDEX IF NOT EXISTS idx_student_invoice_rows_student_status ON public.student_invoice_rows(student_id, status);

COMMENT ON TABLE public.student_invoice_rows IS 'Invoice lines for students: monthly fee, session fee, or manual fine; proof_submitted when student uploads proof.';

-- updated_at triggers for new tables
CREATE OR REPLACE FUNCTION public.set_billing_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_tutor_payouts_updated_at') THEN
    CREATE TRIGGER update_tutor_payouts_updated_at
      BEFORE UPDATE ON public.tutor_payouts FOR EACH ROW EXECUTE FUNCTION public.set_billing_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_tutor_earning_rows_updated_at') THEN
    CREATE TRIGGER update_tutor_earning_rows_updated_at
      BEFORE UPDATE ON public.tutor_earning_rows FOR EACH ROW EXECUTE FUNCTION public.set_billing_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_student_fee_configs_updated_at') THEN
    CREATE TRIGGER update_student_fee_configs_updated_at
      BEFORE UPDATE ON public.student_fee_configs FOR EACH ROW EXECUTE FUNCTION public.set_billing_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_student_invoice_rows_updated_at') THEN
    CREATE TRIGGER update_student_invoice_rows_updated_at
      BEFORE UPDATE ON public.student_invoice_rows FOR EACH ROW EXECUTE FUNCTION public.set_billing_updated_at();
  END IF;
END;
$$;

-- =============================================================================
-- 4. Storage bucket: payment-proofs (private)
-- =============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-proofs',
  'payment-proofs',
  false,
  10485760,  -- 10 MB
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];

-- Storage RLS: path pattern {workspace_id}/{entity_type}/{entity_id}.{ext} (e.g. payouts, invoices)
-- Owner: full access for their workspace (folder prefix = workspace_id)
CREATE POLICY "Workspace owners full access to payment-proofs in their workspace"
ON storage.objects FOR ALL
USING (
  bucket_id = 'payment-proofs'
  AND (storage.foldername(name))[1]::uuid IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
)
WITH CHECK (
  bucket_id = 'payment-proofs'
  AND (storage.foldername(name))[1]::uuid IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
);

-- Tutor: can read own payout proofs (path contains payouts and payout_id belongs to tutor)
CREATE OR REPLACE FUNCTION public.can_tutor_read_payout_proof(object_name text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tutor_payouts p
    WHERE p.id::text = split_part(split_part(object_name, '/', 3), '.', 1)
      AND p.tutor_id = auth.uid()
  );
$$;

CREATE POLICY "Tutors can read own payout proof"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'payment-proofs'
  AND (storage.foldername(name))[2] = 'payouts'
  AND public.can_tutor_read_payout_proof(name)
);

-- Student: can read own invoice proofs; can insert for own unpaid invoice paths (API will validate)
CREATE OR REPLACE FUNCTION public.can_student_read_invoice_proof(object_name text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.student_invoice_rows r
    WHERE r.id::text = split_part(split_part(object_name, '/', 3), '.', 1)
      AND r.student_id = auth.uid()
  );
$$;

CREATE POLICY "Students can read own invoice proof"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'payment-proofs'
  AND (storage.foldername(name))[2] = 'invoices'
  AND public.can_student_read_invoice_proof(name)
);

-- Students can insert only into their workspace invoice path (folder = workspace_id/invoices/); app validates invoice row ownership and status
CREATE POLICY "Students can upload invoice proof into own workspace invoice folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'payment-proofs'
  AND (storage.foldername(name))[2] = 'invoices'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT workspace_id FROM public.workspace_students WHERE student_id = auth.uid()
  )
);

-- =============================================================================
-- 5. RLS on new tables
-- =============================================================================
ALTER TABLE public.tutor_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_earning_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_fee_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_invoice_rows ENABLE ROW LEVEL SECURITY;

-- tutor_payouts: owner CRUD in their workspace; tutor read own
CREATE POLICY "Owners can manage tutor_payouts in their workspace"
ON public.tutor_payouts FOR ALL
USING (public.is_workspace_owner(workspace_id))
WITH CHECK (public.is_workspace_owner(workspace_id));

CREATE POLICY "Tutors can read own tutor_payouts"
ON public.tutor_payouts FOR SELECT
USING (tutor_id = auth.uid());

-- tutor_earning_rows: owner CRUD; tutor read own
CREATE POLICY "Owners can manage tutor_earning_rows in their workspace"
ON public.tutor_earning_rows FOR ALL
USING (public.is_workspace_owner(workspace_id))
WITH CHECK (public.is_workspace_owner(workspace_id));

CREATE POLICY "Tutors can read own tutor_earning_rows"
ON public.tutor_earning_rows FOR SELECT
USING (tutor_id = auth.uid());

-- student_fee_configs: owner CRUD only
CREATE POLICY "Owners can manage student_fee_configs in their workspace"
ON public.student_fee_configs FOR ALL
USING (public.is_workspace_owner(workspace_id))
WITH CHECK (public.is_workspace_owner(workspace_id));

-- student_invoice_rows: owner CRUD; student read own
CREATE POLICY "Owners can manage student_invoice_rows in their workspace"
ON public.student_invoice_rows FOR ALL
USING (public.is_workspace_owner(workspace_id))
WITH CHECK (public.is_workspace_owner(workspace_id));

CREATE POLICY "Students can read own student_invoice_rows"
ON public.student_invoice_rows FOR SELECT
USING (student_id = auth.uid());
