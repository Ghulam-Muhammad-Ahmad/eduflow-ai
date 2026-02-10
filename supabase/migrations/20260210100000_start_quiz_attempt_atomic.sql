-- Atomic start_quiz_attempt: check + insert in one transaction with lock
-- Prevents race where two concurrent requests both pass can_attempt and create 2 attempts when max_attempts=1

CREATE OR REPLACE FUNCTION public.start_quiz_attempt(
  _quiz_id UUID,
  _student_id UUID
)
RETURNS SETOF public.quiz_attempts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  quiz_record RECORD;
  attempt_count INTEGER;
  next_attempt_number INTEGER;
  new_attempt public.quiz_attempts;
  lock_id BIGINT;
BEGIN
  -- Advisory lock per (quiz, student) so only one start_quiz_attempt runs at a time
  lock_id := ('x' || substr(md5(_quiz_id::text || _student_id::text), 1, 16))::bit(64)::bigint;
  PERFORM pg_advisory_xact_lock(lock_id);

  -- Get quiz details
  SELECT * INTO quiz_record
  FROM public.quizzes
  WHERE id = _quiz_id;

  IF quiz_record IS NULL THEN
    RAISE EXCEPTION 'Quiz not found';
  END IF;

  IF quiz_record.status NOT IN ('active', 'scheduled') THEN
    RAISE EXCEPTION 'Quiz is not active';
  END IF;

  IF quiz_record.available_from IS NOT NULL AND now() < quiz_record.available_from THEN
    RAISE EXCEPTION 'Quiz not yet available';
  END IF;

  IF quiz_record.available_until IS NOT NULL AND now() > quiz_record.available_until THEN
    RAISE EXCEPTION 'Quiz deadline has passed';
  END IF;

  -- Must not already have an in-progress attempt
  IF EXISTS (
    SELECT 1 FROM public.quiz_attempts
    WHERE quiz_id = _quiz_id AND student_id = _student_id AND status = 'in_progress'
  ) THEN
    RAISE EXCEPTION 'Quiz already in progress';
  END IF;

  -- Count all attempts (including in_progress) and enforce max_attempts
  SELECT COUNT(*) INTO attempt_count
  FROM public.quiz_attempts
  WHERE quiz_id = _quiz_id AND student_id = _student_id;

  IF quiz_record.max_attempts IS NOT NULL AND attempt_count >= quiz_record.max_attempts THEN
    RAISE EXCEPTION 'Maximum attempts reached';
  END IF;

  -- Next attempt number
  SELECT COALESCE(MAX(attempt_number), 0) + 1 INTO next_attempt_number
  FROM public.quiz_attempts
  WHERE quiz_id = _quiz_id AND student_id = _student_id;

  -- Insert and return the new attempt
  INSERT INTO public.quiz_attempts (quiz_id, student_id, attempt_number, status)
  VALUES (_quiz_id, _student_id, next_attempt_number, 'in_progress')
  RETURNING * INTO new_attempt;

  RETURN NEXT new_attempt;
END;
$$;
