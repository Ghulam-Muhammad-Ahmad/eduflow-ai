-- Extend ai_interactions interaction_type CHECK constraint to include evaluation/matching task types

ALTER TABLE public.ai_interactions
  DROP CONSTRAINT IF EXISTS ai_interactions_interaction_type_check;

ALTER TABLE public.ai_interactions
  ADD CONSTRAINT ai_interactions_interaction_type_check CHECK (
    interaction_type = ANY (ARRAY[
      'content_generation'::text,
      'grading'::text,
      'lesson_planning'::text,
      'study_materials'::text,
      'rubric_generation'::text,
      'quiz_questions'::text,
      'differentiation'::text,
      'concept_explanation'::text,
      'practice_questions'::text,
      'flashcards'::text,
      'study_plan'::text,
      'worksheet_generation'::text,
      'paper_generation'::text,
      'checker'::text,
      'contract_generation'::text,
      'contract_revision'::text,
      'teacher_test_generation'::text,
      'teacher_evaluation'::text,
      'tutor_matching'::text
    ])
  );
