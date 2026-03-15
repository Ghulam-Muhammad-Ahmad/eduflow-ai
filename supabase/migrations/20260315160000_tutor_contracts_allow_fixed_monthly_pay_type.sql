-- Allow monthly pay type on tutor_contracts (align with contract_type for billing).
-- Billing uses contract_type; pay_type is kept in sync for display/legacy.
ALTER TABLE public.tutor_contracts
  DROP CONSTRAINT IF EXISTS tutor_contracts_pay_type_check;

ALTER TABLE public.tutor_contracts
  ADD CONSTRAINT tutor_contracts_pay_type_check
  CHECK (pay_type IN ('hourly', 'per_session', 'fixed_monthly'));

COMMENT ON COLUMN public.tutor_contracts.pay_type IS 'Legacy + display: hourly | per_session | fixed_monthly. Billing uses contract_type.';
