-- ===========================================
-- PHASE 2: AI-POWERED FEATURES
-- ===========================================

-- 1. AI INTERACTIONS TABLE - Track all AI API calls
CREATE TABLE public.ai_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN (
    'content_generation',
    'grading',
    'lesson_planning',
    'study_materials',
    'rubric_generation',
    'quiz_questions',
    'differentiation',
    'concept_explanation',
    'practice_questions',
    'flashcards',
    'study_plan'
  )),
  provider TEXT NOT NULL CHECK (provider IN ('gemini', 'openai')),
  model TEXT NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  cost DECIMAL(10,6) DEFAULT 0,
  request_data JSONB,
  response_data JSONB,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. AI GENERATED CONTENT TABLE - Store AI-generated content
CREATE TABLE public.ai_generated_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN (
    'lesson_plan',
    'worksheet',
    'discussion_questions',
    'project_ideas',
    'rubric',
    'quiz_questions',
    'study_notes',
    'flashcards',
    'practice_questions',
    'summary',
    'concept_explanation',
    'study_plan'
  )),
  title TEXT NOT NULL,
  content JSONB NOT NULL,
  source_materials JSONB, -- Array of document IDs or text sources
  metadata JSONB, -- Additional metadata (grade level, subject, etc.)
  saved_to_documents BOOLEAN DEFAULT false,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. AI FEEDBACK TABLE - Store AI grading feedback
CREATE TABLE public.ai_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feedback_data JSONB NOT NULL, -- Grammar, spelling, content analysis, suggestions
  suggestions JSONB, -- Array of improvement suggestions
  consistency_hash TEXT, -- Hash of similar errors for consistency mode
  rubric_suggestions JSONB, -- Rubric-based scoring suggestions
  accepted BOOLEAN DEFAULT false,
  modified_feedback TEXT, -- Teacher's modified version
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. USER AI USAGE TABLE - Track monthly usage per user
CREATE TABLE public.user_ai_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month DATE NOT NULL, -- First day of the month
  interactions_count INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  cost DECIMAL(10,6) DEFAULT 0,
  limit_reached BOOLEAN DEFAULT false,
  usage_limit INTEGER, -- Monthly limit based on subscription tier
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, month)
);

-- Enable RLS on all AI tables
ALTER TABLE public.ai_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generated_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_ai_usage ENABLE ROW LEVEL SECURITY;

-- =============================================
-- AI INTERACTIONS POLICIES
-- =============================================

-- Users can view their own AI interactions
CREATE POLICY "Users can view their own AI interactions"
ON public.ai_interactions FOR SELECT
USING (user_id = auth.uid());

-- Users can create their own AI interactions
CREATE POLICY "Users can create their own AI interactions"
ON public.ai_interactions FOR INSERT
WITH CHECK (user_id = auth.uid());

-- =============================================
-- AI GENERATED CONTENT POLICIES
-- =============================================

-- Users can view their own generated content
CREATE POLICY "Users can view their own generated content"
ON public.ai_generated_content FOR SELECT
USING (user_id = auth.uid());

-- Users can create their own generated content
CREATE POLICY "Users can create their own generated content"
ON public.ai_generated_content FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Users can update their own generated content
CREATE POLICY "Users can update their own generated content"
ON public.ai_generated_content FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Users can delete their own generated content
CREATE POLICY "Users can delete their own generated content"
ON public.ai_generated_content FOR DELETE
USING (user_id = auth.uid());

-- =============================================
-- AI FEEDBACK POLICIES
-- =============================================

-- Teachers can view feedback for their submissions
CREATE POLICY "Teachers can view AI feedback for their submissions"
ON public.ai_feedback FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.submissions s
    JOIN public.assignments a ON a.id = s.assignment_id
    WHERE s.id = ai_feedback.submission_id
    AND a.teacher_id = auth.uid()
  )
);

-- Teachers can create feedback for their submissions
CREATE POLICY "Teachers can create AI feedback"
ON public.ai_feedback FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.submissions s
    JOIN public.assignments a ON a.id = s.assignment_id
    WHERE s.id = ai_feedback.submission_id
    AND a.teacher_id = auth.uid()
  )
);

-- Teachers can update feedback for their submissions
CREATE POLICY "Teachers can update AI feedback"
ON public.ai_feedback FOR UPDATE
USING (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.submissions s
    JOIN public.assignments a ON a.id = s.assignment_id
    WHERE s.id = ai_feedback.submission_id
    AND a.teacher_id = auth.uid()
  )
);

-- =============================================
-- USER AI USAGE POLICIES
-- =============================================

-- Users can view their own usage
CREATE POLICY "Users can view their own AI usage"
ON public.user_ai_usage FOR SELECT
USING (user_id = auth.uid());

-- System can update usage (via service role)
CREATE POLICY "System can update AI usage"
ON public.user_ai_usage FOR ALL
USING (true)
WITH CHECK (true);

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Function to get or create monthly usage record
CREATE OR REPLACE FUNCTION public.get_or_create_ai_usage(
  _user_id UUID,
  _month DATE DEFAULT date_trunc('month', CURRENT_DATE)::DATE
)
RETURNS public.user_ai_usage AS $$
DECLARE
  usage_record public.user_ai_usage;
  user_role app_role;
  usage_limit INTEGER;
BEGIN
  -- Get user's role to determine limit
  SELECT role INTO user_role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1;

  -- Set limit based on role (default to free tier)
  usage_limit := CASE
    WHEN user_role = 'teacher' THEN 200  -- Teacher Pro default
    WHEN user_role = 'student' THEN 100  -- Student Plus default
    ELSE 10  -- Free tier
  END;

  -- Try to get existing record
  SELECT * INTO usage_record
  FROM public.user_ai_usage
  WHERE user_id = _user_id
  AND month = _month;

  -- Create if doesn't exist
  IF usage_record IS NULL THEN
    INSERT INTO public.user_ai_usage (user_id, month, usage_limit)
    VALUES (_user_id, _month, usage_limit)
    RETURNING * INTO usage_record;
  END IF;

  RETURN usage_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to check if user can make AI request
CREATE OR REPLACE FUNCTION public.can_make_ai_request(_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  usage_record public.user_ai_usage;
  result JSONB;
BEGIN
  -- Get current month usage
  SELECT * INTO usage_record
  FROM public.get_or_create_ai_usage(_user_id);

  -- Check if limit reached
  IF usage_record.limit_reached OR 
     (usage_record.usage_limit IS NOT NULL AND 
      usage_record.interactions_count >= usage_record.usage_limit) THEN
    RETURN jsonb_build_object(
      'can_request', false,
      'reason', 'Monthly AI interaction limit reached',
      'current_usage', usage_record.interactions_count,
      'limit', usage_record.usage_limit
    );
  END IF;

  RETURN jsonb_build_object(
    'can_request', true,
    'current_usage', usage_record.interactions_count,
    'limit', usage_record.usage_limit,
    'remaining', usage_record.usage_limit - usage_record.interactions_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to record AI interaction
CREATE OR REPLACE FUNCTION public.record_ai_interaction(
  _user_id UUID,
  _interaction_type TEXT,
  _provider TEXT,
  _model TEXT,
  _tokens_used INTEGER DEFAULT 0,
  _cost DECIMAL DEFAULT 0,
  _success BOOLEAN DEFAULT true,
  _error_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  interaction_id UUID;
  usage_record public.user_ai_usage;
BEGIN
  -- Record interaction
  INSERT INTO public.ai_interactions (
    user_id,
    interaction_type,
    provider,
    model,
    tokens_used,
    cost,
    success,
    error_message
  )
  VALUES (
    _user_id,
    _interaction_type,
    _provider,
    _model,
    _tokens_used,
    _cost,
    _success,
    _error_message
  )
  RETURNING id INTO interaction_id;

  -- Update usage if successful
  IF _success THEN
    SELECT * INTO usage_record
    FROM public.get_or_create_ai_usage(_user_id);

    UPDATE public.user_ai_usage
    SET
      interactions_count = interactions_count + 1,
      tokens_used = tokens_used + _tokens_used,
      cost = cost + _cost,
      limit_reached = CASE
        WHEN usage_limit IS NOT NULL AND (interactions_count + 1) >= usage_limit
        THEN true
        ELSE limit_reached
      END,
      updated_at = now()
    WHERE id = usage_record.id;
  END IF;

  RETURN interaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================
-- TRIGGERS
-- =============================================

-- Update timestamps triggers
CREATE TRIGGER update_ai_generated_content_updated_at
BEFORE UPDATE ON public.ai_generated_content
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_ai_feedback_updated_at
BEFORE UPDATE ON public.ai_feedback
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_user_ai_usage_updated_at
BEFORE UPDATE ON public.user_ai_usage
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX idx_ai_interactions_user_id ON public.ai_interactions(user_id);
CREATE INDEX idx_ai_interactions_created_at ON public.ai_interactions(created_at);
CREATE INDEX idx_ai_interactions_type ON public.ai_interactions(interaction_type);
CREATE INDEX idx_ai_generated_content_user_id ON public.ai_generated_content(user_id);
CREATE INDEX idx_ai_generated_content_type ON public.ai_generated_content(content_type);
CREATE INDEX idx_ai_feedback_submission_id ON public.ai_feedback(submission_id);
CREATE INDEX idx_ai_feedback_user_id ON public.ai_feedback(user_id);
CREATE INDEX idx_user_ai_usage_user_id ON public.user_ai_usage(user_id);
CREATE INDEX idx_user_ai_usage_month ON public.user_ai_usage(month);
