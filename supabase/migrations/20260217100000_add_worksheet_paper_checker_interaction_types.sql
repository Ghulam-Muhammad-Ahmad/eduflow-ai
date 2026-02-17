-- Allow worksheet_generation, paper_generation, and checker in ai_interactions
-- (TypeScript AITaskType already had these; DB check was missing them)

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
    'checker'
  ));
