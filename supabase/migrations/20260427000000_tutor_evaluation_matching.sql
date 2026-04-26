-- Tutor Evaluation & Matching System
-- Tables: teacher_evaluation_tests, teacher_evaluation_answers,
--         teacher_ai_profiles, student_requirements, tutor_matches

CREATE TABLE teacher_evaluation_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  grades text[] NOT NULL,
  curriculum text[] NOT NULL,
  experience_years int DEFAULT 0,
  language text DEFAULT 'English',
  status text DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','evaluated')),
  questions_json jsonb,
  assigned_by uuid REFERENCES auth.users(id),
  assigned_at timestamptz DEFAULT now(),
  started_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE teacher_evaluation_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_test_id uuid REFERENCES teacher_evaluation_tests(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  answers_json jsonb NOT NULL,
  submitted_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE teacher_ai_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  evaluation_test_id uuid REFERENCES teacher_evaluation_tests(id),
  overall_score int,
  subject_scores jsonb,
  teaching_style_scores jsonb,
  personality_scores jsonb,
  student_fit_scores jsonb,
  preferences jsonb,
  teacher_nature text,
  best_for text[],
  not_best_for text[],
  strengths text[],
  weaknesses text[],
  summary text,
  recommendation text DEFAULT 'needs_review' CHECK (recommendation IN ('approved','needs_review','rejected')),
  owner_reviewed boolean DEFAULT false,
  owner_notes text,
  owner_reviewed_at timestamptz,
  owner_reviewed_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE student_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  student_id uuid REFERENCES auth.users(id),
  student_name text NOT NULL,
  subject text NOT NULL,
  grade text NOT NULL,
  curriculum text NOT NULL,
  student_level text CHECK (student_level IN ('beginner','weak','average','advanced')),
  student_nature text[],
  goal text,
  preferred_teaching_style text,
  language text DEFAULT 'English',
  budget_hourly numeric(10,2),
  availability text[],
  status text DEFAULT 'open' CHECK (status IN ('open','matched','closed')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE tutor_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id uuid REFERENCES student_requirements(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  ranked_matches jsonb NOT NULL,
  best_match_teacher_id uuid REFERENCES auth.users(id),
  ai_explanation jsonb,
  code_scores jsonb,
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','assigned')),
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_tet_teacher ON teacher_evaluation_tests(teacher_id);
CREATE INDEX idx_tet_workspace ON teacher_evaluation_tests(workspace_id);
CREATE INDEX idx_tap_teacher ON teacher_ai_profiles(teacher_id);
CREATE INDEX idx_tap_workspace ON teacher_ai_profiles(workspace_id);
CREATE INDEX idx_sr_workspace ON student_requirements(workspace_id);
CREATE INDEX idx_tm_requirement ON tutor_matches(requirement_id);

-- RLS
ALTER TABLE teacher_evaluation_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_evaluation_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_ai_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutor_matches ENABLE ROW LEVEL SECURITY;

-- teacher_evaluation_tests: teacher sees own; owner sees workspace
CREATE POLICY "teacher sees own evaluation tests"
  ON teacher_evaluation_tests FOR SELECT
  USING (teacher_id = auth.uid());

CREATE POLICY "owner sees workspace evaluation tests"
  ON teacher_evaluation_tests FOR ALL
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- teacher_evaluation_answers: teacher sees own
CREATE POLICY "teacher sees own answers"
  ON teacher_evaluation_answers FOR ALL
  USING (teacher_id = auth.uid());

CREATE POLICY "owner sees workspace answers"
  ON teacher_evaluation_answers FOR SELECT
  USING (
    evaluation_test_id IN (
      SELECT id FROM teacher_evaluation_tests
      WHERE workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
    )
  );

-- teacher_ai_profiles: teacher sees own; owner manages workspace
CREATE POLICY "teacher sees own ai profile"
  ON teacher_ai_profiles FOR SELECT
  USING (teacher_id = auth.uid());

CREATE POLICY "owner manages workspace ai profiles"
  ON teacher_ai_profiles FOR ALL
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- student_requirements: owner manages; teacher cannot access
CREATE POLICY "owner manages student requirements"
  ON student_requirements FOR ALL
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- tutor_matches: owner manages
CREATE POLICY "owner manages tutor matches"
  ON tutor_matches FOR ALL
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );
