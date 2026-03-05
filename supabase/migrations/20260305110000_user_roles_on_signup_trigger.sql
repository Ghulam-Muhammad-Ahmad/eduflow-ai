-- Create user_roles row on signup so client doesn't need a session (fixes RLS 42501 when email confirmation is on)
-- Role is read from raw_user_meta_data.role (set by signUp options.data in the client).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  role_val text;
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email), NEW.email);

  role_val := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'role'), ''), 'student');
  IF role_val NOT IN ('teacher', 'student', 'admin') THEN
    role_val := 'student';
  END IF;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, role_val::public.app_role)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
