-- Onboarding: require tutor/student to change password on first login (invited users).
-- New signups get password_changed_at = now() from default; invited users get null via create-user API.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS password_changed_at timestamptz DEFAULT now();

-- Existing rows receive the default (now()) when column is added, so we don't force existing users.
-- Invited users are updated by create-user API to set password_changed_at = null.
COMMENT ON COLUMN public.profiles.password_changed_at IS 'When user last changed password; null for invited tutor/student until they complete change-password onboarding.';
