-- Add worksheet_builder to ai_generated_content content_type constraint.
-- Run this migration (e.g. copy to supabase/migrations/20260217100000_worksheet_builder_content_type.sql and run supabase db push, or run manually).

ALTER TABLE public.ai_generated_content
  DROP CONSTRAINT IF EXISTS ai_generated_content_content_type_check;

ALTER TABLE public.ai_generated_content
  ADD CONSTRAINT ai_generated_content_content_type_check
  CHECK (content_type IN (
    'rubric',
    'paper',
    'worksheet',
    'quiz_questions',
    'lesson_plan',
    'syllabus_lesson_plan',
    'summary',
    'flashcards',
    'practice_questions',
    'concept_explanation',
    'study_plan',
    'worksheet_builder'
  ));
