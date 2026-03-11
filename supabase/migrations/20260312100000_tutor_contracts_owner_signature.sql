-- Add owner (workspace/client) signature fields to tutor_contracts so both owner and tutor can sign.
ALTER TABLE public.tutor_contracts
  ADD COLUMN IF NOT EXISTS owner_signature_name text,
  ADD COLUMN IF NOT EXISTS owner_signed_at timestamptz;

COMMENT ON COLUMN public.tutor_contracts.owner_signature_name IS 'Full name of the workspace owner when they signed the contract.';
COMMENT ON COLUMN public.tutor_contracts.owner_signed_at IS 'When the workspace owner signed the contract.';
