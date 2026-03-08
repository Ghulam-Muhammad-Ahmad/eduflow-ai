-- Persistent workspace storage allocations for tutors and students.
-- Paddle remains the source of the workspace-wide storage entitlement.

CREATE TABLE IF NOT EXISTS public.user_storage_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_limit_mb integer NOT NULL DEFAULT 0 CHECK (storage_limit_mb >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_storage_allocations_workspace_id
  ON public.user_storage_allocations(workspace_id);

CREATE INDEX IF NOT EXISTS idx_user_storage_allocations_user_id
  ON public.user_storage_allocations(user_id);

ALTER TABLE public.user_storage_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own storage allocations"
  ON public.user_storage_allocations FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Workspace owners can view workspace storage allocations"
  ON public.user_storage_allocations FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspaces w
      WHERE w.id = user_storage_allocations.workspace_id
        AND w.owner_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.assign_storage_to_member(
  _workspace_id uuid,
  _member_user_id uuid,
  _storage_limit_mb integer,
  _caller_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_limit_mb integer := 0;
  assigned_out_mb integer := 0;
  is_owner boolean := false;
  member_in_workspace boolean := false;
BEGIN
  IF _storage_limit_mb IS NULL OR _storage_limit_mb <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Storage limit must be a positive integer');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.workspaces w
    WHERE w.id = _workspace_id
      AND w.owner_id = _caller_user_id
  )
  INTO is_owner;

  IF NOT is_owner THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only workspace owners can assign storage');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = _workspace_id
      AND wm.user_id = _member_user_id
  ) OR EXISTS (
    SELECT 1
    FROM public.tutor_student_assignments tsa
    WHERE tsa.workspace_id = _workspace_id
      AND tsa.student_id = _member_user_id
  )
  INTO member_in_workspace;

  IF NOT member_in_workspace THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Member not found in this workspace');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_storage_allocations usa
    WHERE usa.workspace_id = _workspace_id
      AND usa.user_id = _member_user_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Storage allocation already exists for this member');
  END IF;

  SELECT COALESCE(ws.doc_storage_limit_mb, 100)
  INTO total_limit_mb
  FROM public.workspace_subscriptions ws
  WHERE ws.workspace_id = _workspace_id
    AND ws.status IN ('active', 'trialing')
  LIMIT 1;

  total_limit_mb := COALESCE(total_limit_mb, 100);

  SELECT COALESCE(SUM(usa.storage_limit_mb), 0)
  INTO assigned_out_mb
  FROM public.user_storage_allocations usa
  WHERE usa.workspace_id = _workspace_id;

  IF assigned_out_mb + _storage_limit_mb > total_limit_mb THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Insufficient unassigned storage in workspace pool');
  END IF;

  INSERT INTO public.user_storage_allocations (workspace_id, user_id, storage_limit_mb)
  VALUES (_workspace_id, _member_user_id, _storage_limit_mb);

  RETURN jsonb_build_object('ok', true, 'storage_limit_mb', _storage_limit_mb);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_assigned_storage_limit(
  _workspace_id uuid,
  _member_user_id uuid,
  _new_limit_mb integer,
  _caller_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_owner boolean := false;
  current_limit_mb integer := 0;
  total_limit_mb integer := 0;
  assigned_out_other_mb integer := 0;
  used_bytes bigint := 0;
  used_limit_mb integer := 0;
BEGIN
  IF _new_limit_mb IS NULL OR _new_limit_mb < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Storage limit must be zero or a positive integer');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.workspaces w
    WHERE w.id = _workspace_id
      AND w.owner_id = _caller_user_id
  )
  INTO is_owner;

  IF NOT is_owner THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only workspace owners can update storage');
  END IF;

  SELECT usa.storage_limit_mb
  INTO current_limit_mb
  FROM public.user_storage_allocations usa
  WHERE usa.workspace_id = _workspace_id
    AND usa.user_id = _member_user_id;

  IF current_limit_mb IS NULL THEN
    IF _new_limit_mb = 0 THEN
      RETURN jsonb_build_object('ok', true, 'storage_limit_mb', 0);
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'No storage allocation for this member');
  END IF;

  SELECT COALESCE(SUM(file_size), 0)
  INTO used_bytes
  FROM (
    SELECT d.file_size::bigint AS file_size
    FROM public.documents d
    WHERE d.user_id = _member_user_id

    UNION ALL

    SELECT sd.file_size::bigint AS file_size
    FROM public.source_documents sd
    WHERE sd.teacher_id = _member_user_id
       OR sd.teacher_id IN (
         SELECT p.id
         FROM public.profiles p
         WHERE p.user_id = _member_user_id
       )
  ) AS usage_rows;

  used_limit_mb := CEIL(COALESCE(used_bytes, 0)::numeric / 1048576.0);

  IF _new_limit_mb < used_limit_mb THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', format('New limit cannot be less than already used (%s MB)', used_limit_mb)
    );
  END IF;

  SELECT COALESCE(ws.doc_storage_limit_mb, 100)
  INTO total_limit_mb
  FROM public.workspace_subscriptions ws
  WHERE ws.workspace_id = _workspace_id
    AND ws.status IN ('active', 'trialing')
  LIMIT 1;

  total_limit_mb := COALESCE(total_limit_mb, 100);

  SELECT COALESCE(SUM(usa.storage_limit_mb), 0) - current_limit_mb
  INTO assigned_out_other_mb
  FROM public.user_storage_allocations usa
  WHERE usa.workspace_id = _workspace_id;

  IF assigned_out_other_mb + _new_limit_mb > total_limit_mb THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Insufficient unassigned storage in workspace pool');
  END IF;

  IF _new_limit_mb = 0 THEN
    DELETE FROM public.user_storage_allocations
    WHERE workspace_id = _workspace_id
      AND user_id = _member_user_id;
  ELSE
    UPDATE public.user_storage_allocations
    SET storage_limit_mb = _new_limit_mb,
        updated_at = now()
    WHERE workspace_id = _workspace_id
      AND user_id = _member_user_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'storage_limit_mb', _new_limit_mb);
END;
$$;
