-- New signups (including OAuth) default to owner (admin) when no role in user_metadata.
-- API-created tutors/students pass role in user_metadata so the trigger sets teacher/student.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  role_val text;
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email), NEW.email);

  role_val := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'role'), ''), 'admin');
  IF role_val NOT IN ('teacher', 'student', 'admin') THEN
    role_val := 'admin';
  END IF;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, role_val::public.app_role)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
