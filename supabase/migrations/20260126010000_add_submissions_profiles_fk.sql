-- Add foreign key relationship from submissions.student_id to profiles.user_id
-- This allows PostgREST to properly join submissions with profiles using the syntax:
-- profiles:student_id(...)
-- 
-- Note: PostgreSQL allows multiple foreign keys on the same column referencing different tables.
-- We keep the existing FK to auth.users(id) for RLS policies, and add this one for PostgREST joins.

-- First, ensure all existing submissions have corresponding profiles
-- (This should already be the case due to the trigger, but let's be safe)
INSERT INTO public.profiles (user_id, display_name)
SELECT DISTINCT s.student_id, COALESCE(u.raw_user_meta_data->>'display_name', u.email)
FROM public.submissions s
JOIN auth.users u ON u.id = s.student_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.user_id = s.student_id
)
ON CONFLICT (user_id) DO NOTHING;

-- Add foreign key constraint to profiles.user_id
-- This allows PostgREST to understand the relationship for automatic joins
-- We use CASCADE here because if a profile is deleted, the submission should also be deleted
-- (which aligns with the existing FK to auth.users)
ALTER TABLE public.submissions
ADD CONSTRAINT fk_submissions_student_profile
FOREIGN KEY (student_id) REFERENCES public.profiles(user_id)
ON DELETE CASCADE;
