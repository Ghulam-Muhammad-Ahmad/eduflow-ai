-- Fix quiz attempt counting to include in_progress attempts
-- This prevents students from starting more attempts than allowed

DROP FUNCTION IF EXISTS public.can_attempt_quiz(UUID, UUID);

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
  IF quiz_record.status != 'active' AND quiz_record.status != 'scheduled' THEN
    RETURN jsonb_build_object('can_attempt', false, 'reason', 'Quiz is not active');
  END IF;
  
  -- Check availability window
  IF quiz_record.available_from IS NOT NULL AND now() < quiz_record.available_from THEN
    RETURN jsonb_build_object('can_attempt', false, 'reason', 'Quiz not yet available');
  END IF;
  
  IF quiz_record.available_until IS NOT NULL AND now() > quiz_record.available_until THEN
    RETURN jsonb_build_object('can_attempt', false, 'reason', 'Quiz deadline has passed');
  END IF;
  
  -- Check for in-progress attempt first
  IF EXISTS (
    SELECT 1 FROM public.quiz_attempts
    WHERE quiz_id = _quiz_id
    AND student_id = _student_id
    AND status = 'in_progress'
  ) THEN
    RETURN jsonb_build_object('can_attempt', false, 'reason', 'Quiz already in progress');
  END IF;
  
  -- Check attempt limit - COUNT ALL ATTEMPTS (including in_progress)
  -- This prevents starting more attempts than allowed
  SELECT COUNT(*) INTO attempt_count
  FROM public.quiz_attempts
  WHERE quiz_id = _quiz_id
  AND student_id = _student_id;
  
  IF quiz_record.max_attempts IS NOT NULL AND attempt_count >= quiz_record.max_attempts THEN
    RETURN jsonb_build_object('can_attempt', false, 'reason', 'Maximum attempts reached');
  END IF;
  
  RETURN jsonb_build_object('can_attempt', true, 'reason', null);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
