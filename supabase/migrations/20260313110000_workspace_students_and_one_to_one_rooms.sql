-- workspace_students: students in a workspace (for invite, add-to-classroom, subscription access)
CREATE TABLE IF NOT EXISTS "public"."workspace_students" (
  "workspace_id" uuid NOT NULL REFERENCES "public"."workspaces"("id") ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("workspace_id", "student_id")
);

CREATE INDEX idx_workspace_students_workspace_id ON public.workspace_students (workspace_id);
CREATE INDEX idx_workspace_students_student_id ON public.workspace_students (student_id);

ALTER TABLE public.workspace_students ENABLE ROW LEVEL SECURITY;

-- Owners can manage workspace_students in their workspace
CREATE POLICY "Owners can insert workspace_students"
  ON public.workspace_students FOR INSERT
  WITH CHECK (public.is_workspace_owner(workspace_id));

CREATE POLICY "Owners can delete workspace_students"
  ON public.workspace_students FOR DELETE
  USING (public.is_workspace_owner(workspace_id));

CREATE POLICY "Owners can view workspace_students"
  ON public.workspace_students FOR SELECT
  USING (public.is_workspace_owner(workspace_id));

-- Tutors can view workspace_students in their workspace (for context; owner does the actual add)
CREATE POLICY "Tutors can view workspace_students in their workspace"
  ON public.workspace_students FOR SELECT
  USING (public.is_workspace_member(workspace_id));

GRANT ALL ON TABLE public.workspace_students TO anon;
GRANT ALL ON TABLE public.workspace_students TO authenticated;
GRANT ALL ON TABLE public.workspace_students TO service_role;

-- one_to_one_rooms: 1v1 room = one tutor + one student (owner creates by selecting existing tutor + student)
CREATE TABLE IF NOT EXISTS "public"."one_to_one_rooms" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "public"."workspaces"("id") ON DELETE CASCADE,
  "tutor_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "name" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("workspace_id", "tutor_id", "student_id")
);

CREATE INDEX idx_one_to_one_rooms_workspace_id ON public.one_to_one_rooms (workspace_id);
CREATE INDEX idx_one_to_one_rooms_tutor_id ON public.one_to_one_rooms (tutor_id);
CREATE INDEX idx_one_to_one_rooms_student_id ON public.one_to_one_rooms (student_id);

CREATE TRIGGER update_one_to_one_rooms_updated_at
  BEFORE UPDATE ON public.one_to_one_rooms
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.one_to_one_rooms ENABLE ROW LEVEL SECURITY;

-- Owner: full CRUD for their workspace
CREATE POLICY "Owners can insert one_to_one_rooms"
  ON public.one_to_one_rooms FOR INSERT
  WITH CHECK (public.is_workspace_owner(workspace_id));

CREATE POLICY "Owners can update one_to_one_rooms"
  ON public.one_to_one_rooms FOR UPDATE
  USING (public.is_workspace_owner(workspace_id))
  WITH CHECK (public.is_workspace_owner(workspace_id));

CREATE POLICY "Owners can delete one_to_one_rooms"
  ON public.one_to_one_rooms FOR DELETE
  USING (public.is_workspace_owner(workspace_id));

CREATE POLICY "Owners can view one_to_one_rooms"
  ON public.one_to_one_rooms FOR SELECT
  USING (public.is_workspace_owner(workspace_id));

-- Tutor: can view rooms where they are the tutor
CREATE POLICY "Tutors can view their one_to_one_rooms"
  ON public.one_to_one_rooms FOR SELECT
  USING (tutor_id = auth.uid());

-- Student: can view rooms where they are the student
CREATE POLICY "Students can view their one_to_one_rooms"
  ON public.one_to_one_rooms FOR SELECT
  USING (student_id = auth.uid());

GRANT ALL ON TABLE public.one_to_one_rooms TO anon;
GRANT ALL ON TABLE public.one_to_one_rooms TO authenticated;
GRANT ALL ON TABLE public.one_to_one_rooms TO service_role;

-- Backfill workspace_students from tutor_student_assignments (distinct workspace_id, student_id)
INSERT INTO public.workspace_students (workspace_id, student_id, created_at)
SELECT DISTINCT ON (workspace_id, student_id) workspace_id, student_id, created_at
FROM public.tutor_student_assignments
ON CONFLICT (workspace_id, student_id) DO NOTHING;

-- Backfill one_to_one_rooms from tutor_student_assignments
INSERT INTO public.one_to_one_rooms (workspace_id, tutor_id, student_id, created_at, updated_at)
SELECT workspace_id, tutor_id, student_id, created_at, created_at
FROM public.tutor_student_assignments
ON CONFLICT (workspace_id, tutor_id, student_id) DO NOTHING;

-- Update RLS helpers so one_to_one sessions work: allow if row exists in one_to_one_rooms OR tutor_student_assignments
CREATE OR REPLACE FUNCTION public.can_manage_student_assignment(p_student_id uuid, p_tutor_id uuid, p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.one_to_one_rooms o
    WHERE o.workspace_id = p_workspace_id AND o.student_id = p_student_id AND o.tutor_id = p_tutor_id
      AND (o.tutor_id = auth.uid() OR public.is_workspace_owner(p_workspace_id))
  )
  OR EXISTS (
    SELECT 1 FROM public.tutor_student_assignments tsa
    WHERE tsa.workspace_id = p_workspace_id AND tsa.student_id = p_student_id AND tsa.tutor_id = p_tutor_id
      AND (tsa.tutor_id = auth.uid() OR public.is_workspace_owner(p_workspace_id))
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_student_session(p_student_id uuid, p_tutor_id uuid, p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT auth.uid() = p_student_id
  AND (
    EXISTS (
      SELECT 1 FROM public.one_to_one_rooms o
      WHERE o.workspace_id = p_workspace_id AND o.student_id = p_student_id AND o.tutor_id = p_tutor_id
    )
    OR EXISTS (
      SELECT 1 FROM public.tutor_student_assignments tsa
      WHERE tsa.workspace_id = p_workspace_id AND tsa.student_id = p_student_id AND tsa.tutor_id = p_tutor_id
    )
  );
$$;
