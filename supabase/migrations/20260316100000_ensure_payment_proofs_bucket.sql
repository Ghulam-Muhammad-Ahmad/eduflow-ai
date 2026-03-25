-- Ensure payment-proofs storage bucket exists (student invoice proof upload, owner payout proof).
-- Fixes "Bucket not found" (StorageApiError 404) when students submit proof of payment.
-- Safe to run: upserts the bucket if missing or updates settings.

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
