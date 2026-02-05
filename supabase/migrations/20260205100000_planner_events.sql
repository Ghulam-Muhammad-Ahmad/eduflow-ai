-- =============================================
-- Teacher Lesson Planner: calendar events
-- Teachers can add events manually or via AI suggestions (after review).
-- =============================================

CREATE TABLE public.planner_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  start_at TIMESTAMP WITH TIME ZONE NOT NULL,
  end_at TIMESTAMP WITH TIME ZONE NOT NULL,
  all_day BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for teacher's calendar queries
CREATE INDEX idx_planner_events_teacher_start
  ON public.planner_events (teacher_id, start_at);

ALTER TABLE public.planner_events ENABLE ROW LEVEL SECURITY;

-- Teachers can only manage their own events
CREATE POLICY "Teachers can view own planner events"
  ON public.planner_events FOR SELECT
  USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can insert own planner events"
  ON public.planner_events FOR INSERT
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can update own planner events"
  ON public.planner_events FOR UPDATE
  USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can delete own planner events"
  ON public.planner_events FOR DELETE
  USING (teacher_id = auth.uid());

-- Optional: restrict to users with teacher role (if you use has_role)
-- Here we rely on teacher_id ownership only.

COMMENT ON TABLE public.planner_events IS 'Teacher lesson planner calendar events; AI-suggested events are added only after teacher review.';
