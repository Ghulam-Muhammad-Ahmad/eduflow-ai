-- Drop existing problematic policies
DROP POLICY IF EXISTS "Students can view enrolled classrooms" ON public.classrooms;
DROP POLICY IF EXISTS "Teachers can view enrollments in their classrooms" ON public.enrollments;

-- Create a security definer function to check student enrollment
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
  )
$$;

-- Create a security definer function to check if user is classroom teacher
CREATE OR REPLACE FUNCTION public.is_classroom_teacher(_user_id uuid, _classroom_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.classrooms
    WHERE id = _classroom_id
      AND teacher_id = _user_id
  )
$$;

-- Recreate student policy using the security definer function
CREATE POLICY "Students can view enrolled classrooms" 
ON public.classrooms 
FOR SELECT 
USING (public.is_enrolled_in_classroom(auth.uid(), id));

-- Recreate teacher enrollments policy using security definer function
CREATE POLICY "Teachers can view enrollments in their classrooms" 
ON public.enrollments 
FOR SELECT 
USING (public.is_classroom_teacher(auth.uid(), classroom_id));