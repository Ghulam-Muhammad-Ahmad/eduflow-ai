-- Add classroom_id to student_requirements for class-level requirements
ALTER TABLE student_requirements
  ADD COLUMN IF NOT EXISTS classroom_id uuid REFERENCES classrooms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS requirement_type text DEFAULT 'student' CHECK (requirement_type IN ('student', 'class'));

CREATE INDEX IF NOT EXISTS idx_sr_classroom ON student_requirements(classroom_id);
