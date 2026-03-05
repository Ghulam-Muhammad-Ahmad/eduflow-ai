-- Tutor contracts: formal record per workspace/tutor (rate, contract text, PDF, signing).
-- No invite flow: owner creates tutor and contract; tutor signs or requests change.
-- Also add profiles.bio for tutor public profile.

-- ----------------------------------------------------------------
-- 1. profiles – add bio for tutor description
-- ----------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio text;

-- ----------------------------------------------------------------
-- 2. tutor_contracts
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tutor_contracts (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  tutor_id              uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_status       text        NOT NULL DEFAULT 'draft'
    CHECK (contract_status IN ('draft', 'pending_signature', 'signed', 'change_requested')),
  pay_type              text        NOT NULL DEFAULT 'hourly' CHECK (pay_type IN ('hourly', 'per_session')),
  rate_amount           numeric(10,2) NOT NULL DEFAULT 0,
  rate_currency         text        NOT NULL DEFAULT 'GBP',
  subjects              jsonb       NOT NULL DEFAULT '[]',
  contract_body_text    text,
  contract_storage_path text,
  contract_signed_at    timestamptz,
  tutor_signature_name  text,
  change_requested_at   timestamptz,
  change_request_note   text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, tutor_id)
);

CREATE INDEX IF NOT EXISTS idx_tutor_contracts_workspace_id ON public.tutor_contracts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tutor_contracts_tutor_id ON public.tutor_contracts(tutor_id);

ALTER TABLE public.tutor_contracts ENABLE ROW LEVEL SECURITY;

-- Owner can do everything on contracts in their workspace
DROP POLICY IF EXISTS "Owners can manage tutor_contracts in their workspace" ON public.tutor_contracts;
CREATE POLICY "Owners can manage tutor_contracts in their workspace"
  ON public.tutor_contracts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = tutor_contracts.workspace_id AND w.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = tutor_contracts.workspace_id AND w.owner_id = auth.uid()
    )
  );

-- Tutor can read and update own contract (for sign / request-change)
DROP POLICY IF EXISTS "Tutors can read and update own tutor_contracts" ON public.tutor_contracts;
CREATE POLICY "Tutors can read and update own tutor_contracts"
  ON public.tutor_contracts FOR SELECT
  USING (tutor_id = auth.uid());

DROP POLICY IF EXISTS "Tutors can update own tutor_contracts for sign or request" ON public.tutor_contracts;
CREATE POLICY "Tutors can update own tutor_contracts for sign or request"
  ON public.tutor_contracts FOR UPDATE
  USING (tutor_id = auth.uid());

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_tutor_contracts_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_tutor_contracts_updated_at ON public.tutor_contracts;
CREATE TRIGGER update_tutor_contracts_updated_at
  BEFORE UPDATE ON public.tutor_contracts
  FOR EACH ROW EXECUTE FUNCTION public.set_tutor_contracts_updated_at();

-- ----------------------------------------------------------------
-- 3. Storage bucket for contract PDFs (private; access via signed URLs in API)
-- ----------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('contracts', 'contracts', false)
ON CONFLICT (id) DO NOTHING;

-- Allow workspace owner or the tutor to read contract PDFs (path: workspace_id/tutor_id.pdf)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Contract PDFs readable by workspace owner or tutor'
  ) THEN
    CREATE POLICY "Contract PDFs readable by workspace owner or tutor"
      ON storage.objects FOR SELECT
      USING (
        bucket_id = 'contracts'
        AND (
          (storage.foldername(name))[1] IN (
            SELECT w.id::text FROM public.workspaces w WHERE w.owner_id = auth.uid()
          )
          OR name LIKE '%/' || auth.uid()::text || '.pdf'
        )
      );
  END IF;
END $$;
