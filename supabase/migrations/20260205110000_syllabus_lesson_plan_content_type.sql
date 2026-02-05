-- Allow storing syllabus-based lesson plans in ai_generated_content
ALTER TABLE public.ai_generated_content
  DROP CONSTRAINT IF EXISTS ai_generated_content_content_type_check;

ALTER TABLE public.ai_generated_content
  ADD CONSTRAINT ai_generated_content_content_type_check
  CHECK (content_type IN (
    'lesson_plan',
    'syllabus_lesson_plan',
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
  ));
