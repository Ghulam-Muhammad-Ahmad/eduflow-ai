-- Allow tutors to view profiles of students in their 1v1 rooms.
-- Owner can already see both via owner_can_view_student_profile / owner_can_view_member_profile;
-- tutors could see one_to_one_rooms but the separate profiles query was blocked by RLS.
CREATE POLICY "Tutors can view profiles of students in their 1v1 rooms"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.one_to_one_rooms o
      WHERE o.student_id = profiles.user_id
        AND o.tutor_id = auth.uid()
    )
  );
