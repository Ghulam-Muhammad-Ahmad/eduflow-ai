-- Record the IANA timezone a session was scheduled in.
--
-- starts_at/ends_at are already timestamptz, so the instant is unambiguous; what was
-- missing is the zone the scheduler *meant*. Without it we cannot round-trip the edit
-- form (it would re-render in the viewer's zone), label times unambiguously in the UI,
-- advance a recurring series across a DST boundary, or tell Google Calendar which zone
-- a recurring event follows.
--
-- Nullable with no backfill: existing rows keep today's behaviour of rendering in the
-- viewer's local zone.

ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS timezone text;
ALTER TABLE public.session_series ADD COLUMN IF NOT EXISTS timezone text;

COMMENT ON COLUMN public.sessions.timezone IS
  'IANA timezone the session was scheduled in (e.g. Europe/London). Null for rows created before timezone support.';
COMMENT ON COLUMN public.session_series.timezone IS
  'IANA timezone the series was scheduled in (e.g. Europe/London). Null for rows created before timezone support.';
