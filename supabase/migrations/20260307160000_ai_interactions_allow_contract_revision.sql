-- Allow contract_revision in ai_interactions (same credit flow as contract generation)
ALTER TABLE public.ai_interactions
  DROP CONSTRAINT IF EXISTS ai_interactions_interaction_type_check;

ALTER TABLE public.ai_interactions
  ADD CONSTRAINT ai_interactions_interaction_type_check
  CHECK (interaction_type IN (
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
    'study_plan',
    'worksheet_generation',
    'paper_generation',
    'checker',
    'contract_generation',
    'contract_revision'
  ));
