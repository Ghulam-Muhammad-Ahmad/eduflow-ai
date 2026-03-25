-- Fix owner RLS for assignments and quizzes so they show on owner classroom detail.
-- The previous policy used is_classroom_in_owner_workspace(classroom_id, ...) which expects
-- a teacher user_id, not a classroom_id. Use is_classroom_owned_by_owner for classroom_id.

-- Fix is_submission_in_owner_workspace: use is_classroom_owned_by_owner for classroom_id (same bug)
CREATE OR REPLACE FUNCTION public.is_submission_in_owner_workspace(p_assignment_id uuid, p_owner_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id = p_assignment_id
      AND (
        (a.classroom_id IS NOT NULL AND public.is_classroom_owned_by_owner(a.classroom_id, p_owner_id))
        OR (a.one_to_one_room_id IS NOT NULL AND public.is_one_to_one_room_in_owner_workspace(a.one_to_one_room_id, p_owner_id))
      )
  );
$$;

DROP POLICY IF EXISTS "Owners can view assignments in their workspace" ON public.assignments;
CREATE POLICY "Owners can view assignments in their workspace"
  ON public.assignments FOR SELECT
  USING (
    (classroom_id IS NOT NULL AND public.is_classroom_owned_by_owner(classroom_id, auth.uid()))
    OR (one_to_one_room_id IS NOT NULL AND public.is_one_to_one_room_in_owner_workspace(one_to_one_room_id, auth.uid()))
  );

DROP POLICY IF EXISTS "Owners can view quizzes in their workspace" ON public.quizzes;
CREATE POLICY "Owners can view quizzes in their workspace"
  ON public.quizzes FOR SELECT
  USING (
    (classroom_id IS NOT NULL AND public.is_classroom_owned_by_owner(classroom_id, auth.uid()))
    OR (one_to_one_room_id IS NOT NULL AND public.is_one_to_one_room_in_owner_workspace(one_to_one_room_id, auth.uid()))
  );
