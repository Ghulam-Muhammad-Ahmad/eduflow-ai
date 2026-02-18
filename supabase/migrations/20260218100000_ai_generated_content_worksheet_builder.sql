-- Allow 'worksheet_builder' for AI Studio Worksheet Maker (editable worksheet content)
ALTER TABLE public.ai_generated_content
  DROP CONSTRAINT IF EXISTS ai_generated_content_content_type_check;

ALTER TABLE public.ai_generated_content
  ADD CONSTRAINT ai_generated_content_content_type_check
  CHECK (content_type IN (
    'lesson_plan',
    'syllabus_lesson_plan',
    'worksheet',
    'worksheet_builder',
    'discussion_questions',
    'project_ideas',
    'rubric',
    'paper',
    'quiz_questions',
    'study_notes',
    'flashcards',
    'practice_questions',
    'summary',
    'concept_explanation',
    'study_plan'
  ));
