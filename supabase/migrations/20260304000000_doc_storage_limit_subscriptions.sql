-- Add doc_storage_limit_mb to subscription tables (set from Paddle product custom_data.doc_storage in GB).
-- Unit in DB: MB. Product custom_data.doc_storage is in GB (e.g. 5 => 5120 MB).

ALTER TABLE public.workspace_subscriptions
  ADD COLUMN IF NOT EXISTS doc_storage_limit_mb integer;

ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS doc_storage_limit_mb integer;

COMMENT ON COLUMN public.workspace_subscriptions.doc_storage_limit_mb IS 'Max Doc Center storage in MB; from Paddle product custom_data.doc_storage (GB).';
COMMENT ON COLUMN public.user_subscriptions.doc_storage_limit_mb IS 'Max Doc Center storage in MB; from Paddle product custom_data.doc_storage (GB).';
