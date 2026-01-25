-- ===========================================
-- PHASE 1: QUIZZES FEATURE
-- ===========================================

-- 1. QUIZZES TABLE
CREATE TABLE public.quizzes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  instructions TEXT,
  time_limit_minutes INTEGER, -- NULL means no time limit
  available_from TIMESTAMP WITH TIME ZONE,
  available_until TIMESTAMP WITH TIME ZONE,
  passing_score DECIMAL(5,2), -- Percentage (0-100)
  max_attempts INTEGER DEFAULT 1,
  randomize_questions BOOLEAN DEFAULT false,
  show_correct_answers BOOLEAN DEFAULT true, -- Show correct answers after submission
  show_results_immediately BOOLEAN DEFAULT true, -- Show score immediately after submission
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'closed')),
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. QUIZ QUESTIONS TABLE
CREATE TABLE public.quiz_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'true_false', 'short_answer')),
  question_text TEXT NOT NULL,
  points DECIMAL(5,2) NOT NULL DEFAULT 1.0,
  order_index INTEGER NOT NULL DEFAULT 0,
  options JSONB, -- For multiple choice: array of {id, text, is_correct}
  correct_answer TEXT, -- For true_false and short_answer
  explanation TEXT, -- Optional explanation shown after submission
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. QUIZ ATTEMPTS TABLE
CREATE TABLE public.quiz_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  submitted_at TIMESTAMP WITH TIME ZONE,
  time_spent_seconds INTEGER, -- Calculated time between start and submit
  answers JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {question_id, answer, is_correct, points_earned}
  score DECIMAL(5,2), -- Percentage (0-100)
  points_earned DECIMAL(10,2),
  points_possible DECIMAL(10,2),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'graded')),
  auto_graded_at TIMESTAMP WITH TIME ZONE,
  manually_graded_at TIMESTAMP WITH TIME ZONE,
  feedback TEXT, -- Teacher feedback
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all quiz tables
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

-- =============================================
-- QUIZ POLICIES
-- =============================================

-- Teachers can view their own quizzes
CREATE POLICY "Teachers can view their own quizzes"
ON public.quizzes FOR SELECT
USING (teacher_id = auth.uid());

-- Teachers can create quizzes
CREATE POLICY "Teachers can create quizzes"
ON public.quizzes FOR INSERT
WITH CHECK (teacher_id = auth.uid());

-- Teachers can update their own quizzes
CREATE POLICY "Teachers can update their own quizzes"
ON public.quizzes FOR UPDATE
USING (teacher_id = auth.uid())
WITH CHECK (teacher_id = auth.uid());

-- Teachers can delete their own quizzes
CREATE POLICY "Teachers can delete their own quizzes"
ON public.quizzes FOR DELETE
USING (teacher_id = auth.uid());

-- Students can view active quizzes in their enrolled classrooms
CREATE POLICY "Students can view active quizzes"
ON public.quizzes FOR SELECT
USING (
  status IN ('scheduled', 'active') AND
  EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE enrollments.classroom_id = quizzes.classroom_id
    AND enrollments.student_id = auth.uid()
    AND enrollments.status = 'active'
  )
);

-- =============================================
-- QUIZ QUESTIONS POLICIES
-- =============================================

-- Teachers can view questions for their quizzes
CREATE POLICY "Teachers can view their quiz questions"
ON public.quiz_questions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.quizzes
    WHERE quizzes.id = quiz_questions.quiz_id
    AND quizzes.teacher_id = auth.uid()
  )
);

-- Teachers can create questions for their quizzes
CREATE POLICY "Teachers can create quiz questions"
ON public.quiz_questions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.quizzes
    WHERE quizzes.id = quiz_questions.quiz_id
    AND quizzes.teacher_id = auth.uid()
  )
);

-- Teachers can update questions for their quizzes
CREATE POLICY "Teachers can update quiz questions"
ON public.quiz_questions FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.quizzes
    WHERE quizzes.id = quiz_questions.quiz_id
    AND quizzes.teacher_id = auth.uid()
  )
);

-- Teachers can delete questions from their quizzes
CREATE POLICY "Teachers can delete quiz questions"
ON public.quiz_questions FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.quizzes
    WHERE quizzes.id = quiz_questions.quiz_id
    AND quizzes.teacher_id = auth.uid()
  )
);

-- Students can view questions for quizzes they can access
CREATE POLICY "Students can view quiz questions"
ON public.quiz_questions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.quizzes q
    JOIN public.enrollments e ON e.classroom_id = q.classroom_id
    WHERE q.id = quiz_questions.quiz_id
    AND q.status IN ('scheduled', 'active')
    AND e.student_id = auth.uid()
    AND e.status = 'active'
  )
);

-- =============================================
-- QUIZ ATTEMPTS POLICIES
-- =============================================

-- Students can view their own attempts
CREATE POLICY "Students can view their own quiz attempts"
ON public.quiz_attempts FOR SELECT
USING (student_id = auth.uid());

-- Students can create attempts for quizzes they can access
CREATE POLICY "Students can start quiz attempts"
ON public.quiz_attempts FOR INSERT
WITH CHECK (
  student_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.quizzes q
    JOIN public.enrollments e ON e.classroom_id = q.classroom_id
    WHERE q.id = quiz_attempts.quiz_id
    AND q.status = 'active'
    AND e.student_id = auth.uid()
    AND e.status = 'active'
  )
);

-- Students can update their own attempts (submit answers)
CREATE POLICY "Students can update their own quiz attempts"
ON public.quiz_attempts FOR UPDATE
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

-- Teachers can view attempts for their quizzes
CREATE POLICY "Teachers can view quiz attempts"
ON public.quiz_attempts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.quizzes
    WHERE quizzes.id = quiz_attempts.quiz_id
    AND quizzes.teacher_id = auth.uid()
  )
);

-- Teachers can update attempts (for grading short answers)
CREATE POLICY "Teachers can grade quiz attempts"
ON public.quiz_attempts FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.quizzes
    WHERE quizzes.id = quiz_attempts.quiz_id
    AND quizzes.teacher_id = auth.uid()
  )
);

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Function to calculate quiz score automatically
CREATE OR REPLACE FUNCTION public.calculate_quiz_score(attempt_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  total_points DECIMAL(10,2);
  earned_points DECIMAL(10,2);
  score_percentage DECIMAL(5,2);
BEGIN
  -- Calculate total points from answers
  SELECT 
    SUM((answer->>'points_possible')::DECIMAL),
    SUM((answer->>'points_earned')::DECIMAL)
  INTO total_points, earned_points
  FROM public.quiz_attempts,
  LATERAL jsonb_array_elements(answers) AS answer
  WHERE id = attempt_id;
  
  -- Calculate percentage
  IF total_points > 0 THEN
    score_percentage := (earned_points / total_points) * 100;
  ELSE
    score_percentage := 0;
  END IF;
  
  -- Return result
  result := jsonb_build_object(
    'points_earned', earned_points,
    'points_possible', total_points,
    'score', score_percentage
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to check if student can attempt quiz
CREATE OR REPLACE FUNCTION public.can_attempt_quiz(
  _quiz_id UUID,
  _student_id UUID
)
RETURNS JSONB AS $$
DECLARE
  quiz_record RECORD;
  attempt_count INTEGER;
  result JSONB;
BEGIN
  -- Get quiz details
  SELECT * INTO quiz_record
  FROM public.quizzes
  WHERE id = _quiz_id;
  
  IF quiz_record IS NULL THEN
    RETURN jsonb_build_object('can_attempt', false, 'reason', 'Quiz not found');
  END IF;
  
  -- Check if quiz is active
  IF quiz_record.status != 'active' THEN
    RETURN jsonb_build_object('can_attempt', false, 'reason', 'Quiz is not active');
  END IF;
  
  -- Check availability window
  IF quiz_record.available_from IS NOT NULL AND now() < quiz_record.available_from THEN
    RETURN jsonb_build_object('can_attempt', false, 'reason', 'Quiz not yet available');
  END IF;
  
  IF quiz_record.available_until IS NOT NULL AND now() > quiz_record.available_until THEN
    RETURN jsonb_build_object('can_attempt', false, 'reason', 'Quiz deadline has passed');
  END IF;
  
  -- Check attempt limit
  SELECT COUNT(*) INTO attempt_count
  FROM public.quiz_attempts
  WHERE quiz_id = _quiz_id
  AND student_id = _student_id
  AND status IN ('submitted', 'graded');
  
  IF quiz_record.max_attempts IS NOT NULL AND attempt_count >= quiz_record.max_attempts THEN
    RETURN jsonb_build_object('can_attempt', false, 'reason', 'Maximum attempts reached');
  END IF;
  
  -- Check for in-progress attempt
  IF EXISTS (
    SELECT 1 FROM public.quiz_attempts
    WHERE quiz_id = _quiz_id
    AND student_id = _student_id
    AND status = 'in_progress'
  ) THEN
    RETURN jsonb_build_object('can_attempt', false, 'reason', 'Quiz already in progress');
  END IF;
  
  RETURN jsonb_build_object('can_attempt', true, 'reason', null);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================
-- TRIGGERS
-- =============================================

-- Update timestamps triggers
CREATE TRIGGER update_quizzes_updated_at
BEFORE UPDATE ON public.quizzes
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_quiz_attempts_updated_at
BEFORE UPDATE ON public.quiz_attempts
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX idx_quizzes_classroom_id ON public.quizzes(classroom_id);
CREATE INDEX idx_quizzes_teacher_id ON public.quizzes(teacher_id);
CREATE INDEX idx_quizzes_status ON public.quizzes(status);
CREATE INDEX idx_quiz_questions_quiz_id ON public.quiz_questions(quiz_id);
CREATE INDEX idx_quiz_attempts_quiz_id ON public.quiz_attempts(quiz_id);
CREATE INDEX idx_quiz_attempts_student_id ON public.quiz_attempts(student_id);
CREATE INDEX idx_quiz_attempts_status ON public.quiz_attempts(status);
