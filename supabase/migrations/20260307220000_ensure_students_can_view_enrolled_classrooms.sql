-- Ensure students can view classrooms they are enrolled in.
-- Recreate the policy so it's present regardless of migration order or prior state.

CREATE OR REPLACE FUNCTION public.is_enrolled_in_classroom(_user_id uuid, _classroom_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.enrollments
    WHERE student_id = _user_id
      AND classroom_id = _classroom_id
      AND status = 'active'
  );
$$;

DROP POLICY IF EXISTS "Students can view enrolled classrooms" ON public.classrooms;
CREATE POLICY "Students can view enrolled classrooms"
  ON public.classrooms
  FOR SELECT
  USING (public.is_enrolled_in_classroom(auth.uid(), id));
