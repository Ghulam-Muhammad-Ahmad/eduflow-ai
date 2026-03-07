-- Fix infinite recursion: classrooms RLS references classroom_tutors, and classroom_tutors
-- RLS references classrooms. Use a SECURITY DEFINER function so the check bypasses RLS.

CREATE OR REPLACE FUNCTION public.is_user_tutor_of_classroom(
  p_user_id    uuid,
  p_classroom_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classrooms c
    WHERE c.id = p_classroom_id
      AND c.teacher_id = p_user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.classroom_tutors ct
    WHERE ct.classroom_id = p_classroom_id
      AND ct.user_id = p_user_id
  );
$$;

-- Recreate classrooms policies to use the function (no direct reference to classroom_tutors)
DROP POLICY IF EXISTS "Teachers can view their own classrooms" ON public.classrooms;
CREATE POLICY "Teachers can view their own classrooms"
  ON public.classrooms FOR SELECT
  USING (public.is_user_tutor_of_classroom(auth.uid(), id));

DROP POLICY IF EXISTS "Teachers can update their own classrooms" ON public.classrooms;
CREATE POLICY "Teachers can update their own classrooms"
  ON public.classrooms FOR UPDATE
  USING (public.is_user_tutor_of_classroom(auth.uid(), id))
  WITH CHECK (public.is_user_tutor_of_classroom(auth.uid(), id));

-- Recreate classroom_tutors SELECT policy to use the function (no direct reference to classrooms)
DROP POLICY IF EXISTS "Tutors can view classroom_tutors for their classrooms" ON public.classroom_tutors;
CREATE POLICY "Tutors can view classroom_tutors for their classrooms"
  ON public.classroom_tutors FOR SELECT
  USING (public.is_user_tutor_of_classroom(auth.uid(), classroom_id));
