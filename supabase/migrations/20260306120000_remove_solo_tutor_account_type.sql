-- Remove solo_tutor account type: only owner (business) has tenant users (tutors, students).
-- account_type: business | student | tutor (tutor = tenant-created by owner).

-- 1. Drop the old account_type check constraint first (so we can write 'tutor')
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.profiles'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) LIKE '%solo_tutor%'
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- 2. Migrate existing solo_tutor profiles to tutor
UPDATE public.profiles
SET account_type = 'tutor'
WHERE account_type = 'solo_tutor';

-- 3. Add new check: business | student | tutor
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_account_type_check
  CHECK (account_type IS NULL OR account_type IN ('business', 'student', 'tutor'));
