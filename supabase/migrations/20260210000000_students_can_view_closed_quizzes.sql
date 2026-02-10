-- Allow students to see closed quizzes in their enrolled classrooms (for Closed tab and viewing results)
DROP POLICY IF EXISTS "Students can view active quizzes" ON public.quizzes;

CREATE POLICY "Students can view quizzes in enrolled classrooms"
ON public.quizzes FOR SELECT
USING (
  status IN ('scheduled', 'active', 'closed') AND
  EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE enrollments.classroom_id = quizzes.classroom_id
    AND enrollments.student_id = auth.uid()
    AND enrollments.status = 'active'
  )
);