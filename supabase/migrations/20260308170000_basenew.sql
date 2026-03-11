


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."app_role" AS ENUM (
    'teacher',
    'student',
    'admin'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_credits_to_member"("_workspace_id" "uuid", "_member_user_id" "uuid", "_credits" integer, "_caller_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _period date := date_trunc('month', current_date)::date;
  pool record;
  is_caller_owner_or_tutor boolean := false;
  current_limit integer := 0;
BEGIN
  IF _credits IS NULL OR _credits <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Credits must be positive');
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = _workspace_id AND w.owner_id = _caller_user_id)
    OR EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = _workspace_id AND wm.user_id = _caller_user_id)
  INTO is_caller_owner_or_tutor;
  IF NOT is_caller_owner_or_tutor THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not a workspace owner or member');
  END IF;

  INSERT INTO public.workspace_credit_pools (workspace_id, period, credits_allocated, credits_assigned_out, credits_used_direct)
  VALUES (_workspace_id, _period, 0, 0, 0)
  ON CONFLICT (workspace_id, period) DO NOTHING;

  SELECT wcp.credits_allocated, wcp.credits_assigned_out, wcp.id INTO pool
  FROM public.workspace_credit_pools wcp
  WHERE wcp.workspace_id = _workspace_id AND wcp.period = _period;

  IF pool.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No credit pool for this workspace this period');
  END IF;

  IF (pool.credits_allocated - pool.credits_assigned_out) < _credits THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Insufficient credits in workspace pool');
  END IF;

  UPDATE public.workspace_credit_pools
  SET credits_assigned_out = credits_assigned_out + _credits, updated_at = now()
  WHERE workspace_id = _workspace_id AND period = _period;

  SELECT coalesce(uca.credits_limit, 0) INTO current_limit
  FROM public.user_credit_allocations uca
  WHERE uca.user_id = _member_user_id AND uca.period = _period AND uca.source_type = 'workspace' AND uca.source_id = _workspace_id;

  IF current_limit > 0 THEN
    UPDATE public.user_credit_allocations SET credits_limit = credits_limit + _credits, updated_at = now()
    WHERE user_id = _member_user_id AND period = _period AND source_type = 'workspace' AND source_id = _workspace_id;
  ELSE
    INSERT INTO public.user_credit_allocations (user_id, period, source_type, source_id, credits_limit, credits_used)
    VALUES (_member_user_id, _period, 'workspace', _workspace_id, _credits, 0);
  END IF;

  INSERT INTO public.credit_assignments_audit (workspace_id, period, assigned_by_user_id, assigned_to_user_id, credits, action, new_limit)
  VALUES (_workspace_id, _period, _caller_user_id, _member_user_id, _credits, 'assign', current_limit + _credits);

  RETURN jsonb_build_object('ok', true, 'assigned', _credits);
END;
$$;


ALTER FUNCTION "public"."assign_credits_to_member"("_workspace_id" "uuid", "_member_user_id" "uuid", "_credits" integer, "_caller_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_storage_to_member"("_workspace_id" "uuid", "_member_user_id" "uuid", "_storage_limit_mb" integer, "_caller_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."assign_storage_to_member"("_workspace_id" "uuid", "_member_user_id" "uuid", "_storage_limit_mb" integer, "_caller_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_quiz_score"("attempt_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result JSONB;
  total_points DECIMAL(10,2);
  earned_points DECIMAL(10,2);
  score_percentage DECIMAL(5,2);
BEGIN
  -- Calculate total points from answers
  SELECT 
    SUM((answer->>'points_possible')::DECIMAL),
    SUM((answer->>'points_earned')::DECIMAL)
  INTO total_points, earned_points
  FROM public.quiz_attempts,
  LATERAL jsonb_array_elements(answers) AS answer
  WHERE id = attempt_id;
  
  -- Calculate percentage
  IF total_points > 0 THEN
    score_percentage := (earned_points / total_points) * 100;
  ELSE
    score_percentage := 0;
  END IF;
  
  -- Return result
  result := jsonb_build_object(
    'points_earned', earned_points,
    'points_possible', total_points,
    'score', score_percentage
  );
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."calculate_quiz_score"("attempt_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_attempt_quiz"("_quiz_id" "uuid", "_student_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  quiz_record RECORD;
  attempt_count INTEGER;
  result JSONB;
BEGIN
  -- Get quiz details
  SELECT * INTO quiz_record
  FROM public.quizzes
  WHERE id = _quiz_id;
  
  IF quiz_record IS NULL THEN
    RETURN jsonb_build_object('can_attempt', false, 'reason', 'Quiz not found');
  END IF;
  
  -- Check if quiz is active
  IF quiz_record.status != 'active' AND quiz_record.status != 'scheduled' THEN
    RETURN jsonb_build_object('can_attempt', false, 'reason', 'Quiz is not active');
  END IF;
  
  -- Check availability window
  IF quiz_record.available_from IS NOT NULL AND now() < quiz_record.available_from THEN
    RETURN jsonb_build_object('can_attempt', false, 'reason', 'Quiz not yet available');
  END IF;
  
  IF quiz_record.available_until IS NOT NULL AND now() > quiz_record.available_until THEN
    RETURN jsonb_build_object('can_attempt', false, 'reason', 'Quiz deadline has passed');
  END IF;
  
  -- Check for in-progress attempt first
  IF EXISTS (
    SELECT 1 FROM public.quiz_attempts
    WHERE quiz_id = _quiz_id
    AND student_id = _student_id
    AND status = 'in_progress'
  ) THEN
    RETURN jsonb_build_object('can_attempt', false, 'reason', 'Quiz already in progress');
  END IF;
  
  -- Check attempt limit - COUNT ALL ATTEMPTS (including in_progress)
  -- This prevents starting more attempts than allowed
  SELECT COUNT(*) INTO attempt_count
  FROM public.quiz_attempts
  WHERE quiz_id = _quiz_id
  AND student_id = _student_id;
  
  IF quiz_record.max_attempts IS NOT NULL AND attempt_count >= quiz_record.max_attempts THEN
    RETURN jsonb_build_object('can_attempt', false, 'reason', 'Maximum attempts reached');
  END IF;
  
  RETURN jsonb_build_object('can_attempt', true, 'reason', null);
END;
$$;


ALTER FUNCTION "public"."can_attempt_quiz"("_quiz_id" "uuid", "_student_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_make_ai_request"("_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  usage_record public.user_ai_usage;
  remaining_tokens INTEGER;
BEGIN
  SELECT * INTO usage_record
  FROM public.get_or_create_ai_usage(_user_id);

  remaining_tokens := GREATEST(0, COALESCE(usage_record.usage_limit, 0) - usage_record.tokens_used);

  -- Limit is based on tokens_used >= usage_limit (tokens per month)
  IF usage_record.limit_reached OR
     (usage_record.usage_limit IS NOT NULL AND usage_record.tokens_used >= usage_record.usage_limit) THEN
    RETURN jsonb_build_object(
      'can_request', false,
      'reason', 'Monthly AI token limit reached',
      'current_usage', usage_record.tokens_used,
      'limit', usage_record.usage_limit,
      'remaining', 0
    );
  END IF;

  RETURN jsonb_build_object(
    'can_request', true,
    'current_usage', usage_record.tokens_used,
    'limit', usage_record.usage_limit,
    'remaining', remaining_tokens
  );
END;
$$;


ALTER FUNCTION "public"."can_make_ai_request"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_student_assignment"("p_student_id" "uuid", "p_tutor_id" "uuid", "p_workspace_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tutor_student_assignments tsa
    WHERE tsa.workspace_id = p_workspace_id
      AND tsa.student_id = p_student_id
      AND tsa.tutor_id = p_tutor_id
      AND (
        tsa.tutor_id = auth.uid()
        OR public.is_workspace_owner(p_workspace_id)
      )
  );
$$;


ALTER FUNCTION "public"."can_manage_student_assignment"("p_student_id" "uuid", "p_tutor_id" "uuid", "p_workspace_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_view_student_session"("p_student_id" "uuid", "p_tutor_id" "uuid", "p_workspace_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT auth.uid() = p_student_id
    AND EXISTS (
      SELECT 1
      FROM public.tutor_student_assignments tsa
      WHERE tsa.workspace_id = p_workspace_id
        AND tsa.student_id = p_student_id
        AND tsa.tutor_id = p_tutor_id
    );
$$;


ALTER FUNCTION "public"."can_view_student_session"("p_student_id" "uuid", "p_tutor_id" "uuid", "p_workspace_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_and_deduct_credits"("_user_id" "uuid", "_task_type" "text", "_credit_cost" integer, "_interaction_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _period date := date_trunc('month', current_date)::date;
  total_remaining integer := 0;
  to_deduct integer := _credit_cost;
  alloc record;
  new_used integer;
  ws_id uuid;
  pool_rem integer;
BEGIN
  IF _credit_cost IS NULL OR _credit_cost <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'remaining', 0, 'deducted', 0);
  END IF;

  SELECT coalesce(sum(uca.credits_limit - uca.credits_used), 0) INTO total_remaining
  FROM public.user_credit_allocations uca
  WHERE uca.user_id = _user_id AND uca.period = _period;

  IF total_remaining >= _credit_cost THEN
    FOR alloc IN
      SELECT id, credits_limit, credits_used
      FROM public.user_credit_allocations
      WHERE user_id = _user_id AND period = _period
      ORDER BY id
    LOOP
      EXIT WHEN to_deduct <= 0;
      new_used := alloc.credits_used + least(to_deduct, alloc.credits_limit - alloc.credits_used);
      to_deduct := to_deduct - (new_used - alloc.credits_used);
      UPDATE public.user_credit_allocations
      SET credits_used = new_used, updated_at = now()
      WHERE id = alloc.id;
    END LOOP;
    INSERT INTO public.ai_interactions (user_id, interaction_type, credits_deducted, success, provider, model, tokens_used, cost, error_message)
    VALUES (_user_id, _task_type, _credit_cost, true, 'openai', '', 0, 0, null);
    RETURN jsonb_build_object('ok', true, 'remaining', total_remaining - _credit_cost, 'deducted', _credit_cost);
  END IF;

  SELECT wm.workspace_id INTO ws_id
  FROM public.workspace_members wm
  WHERE wm.user_id = _user_id
  LIMIT 1;
  IF ws_id IS NULL THEN
    SELECT w.id INTO ws_id FROM public.workspaces w WHERE w.owner_id = _user_id LIMIT 1;
  END IF;
  IF ws_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Insufficient credits', 'remaining', coalesce(total_remaining, 0), 'required', _credit_cost);
  END IF;

  SELECT (wcp.credits_allocated - wcp.credits_assigned_out - wcp.credits_used_direct) INTO pool_rem
  FROM public.workspace_credit_pools wcp
  WHERE wcp.workspace_id = ws_id AND wcp.period = _period;

  IF pool_rem IS NULL OR pool_rem < _credit_cost THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Insufficient credits', 'remaining', coalesce(pool_rem, 0), 'required', _credit_cost);
  END IF;

  UPDATE public.workspace_credit_pools
  SET credits_used_direct = credits_used_direct + _credit_cost, updated_at = now()
  WHERE workspace_id = ws_id AND period = _period;

  INSERT INTO public.ai_interactions (user_id, interaction_type, credits_deducted, success, provider, model, tokens_used, cost, error_message)
  VALUES (_user_id, _task_type, _credit_cost, true, 'openai', '', 0, 0, null);

  RETURN jsonb_build_object('ok', true, 'remaining', pool_rem - _credit_cost, 'deducted', _credit_cost);
END;
$$;


ALTER FUNCTION "public"."check_and_deduct_credits"("_user_id" "uuid", "_task_type" "text", "_credit_cost" integer, "_interaction_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_join_code"() RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  code TEXT;
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code_exists BOOLEAN;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    
    SELECT EXISTS(SELECT 1 FROM public.classrooms WHERE join_code = code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN code;
END;
$$;


ALTER FUNCTION "public"."generate_join_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_classroom_by_join_code"("code" "text") RETURNS TABLE("id" "uuid", "name" "text", "description" "text", "subject" "text", "teacher_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.description,
    c.subject,
    COALESCE(p.display_name, 'Teacher') as teacher_name
  FROM public.classrooms c
  LEFT JOIN public.profiles p ON p.user_id = c.teacher_id
  WHERE c.join_code = UPPER(code)
  AND c.is_archived = false;
END;
$$;


ALTER FUNCTION "public"."get_classroom_by_join_code"("code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_credit_context"("_user_id" "uuid") RETURNS TABLE("credits_limit" integer, "credits_used" integer, "remaining" integer, "source_type" "text", "source_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _period date := date_trunc('month', current_date)::date;
  total_limit integer := 0;
  total_used integer := 0;
  ws_id uuid;
  pool_rem integer;
BEGIN
  SELECT coalesce(sum(uca.credits_limit), 0), coalesce(sum(uca.credits_used), 0)
  INTO total_limit, total_used
  FROM public.user_credit_allocations uca
  WHERE uca.user_id = _user_id AND uca.period = _period;

  IF total_limit = 0 AND total_used = 0 THEN
    -- Prefer workspace the user OWNS so owner's "remaining" reflects pool after assigning to tutor/student
    SELECT w.id INTO ws_id FROM public.workspaces w WHERE w.owner_id = _user_id LIMIT 1;
    IF ws_id IS NULL THEN
      SELECT wm.workspace_id INTO ws_id
      FROM public.workspace_members wm
      WHERE wm.user_id = _user_id
      LIMIT 1;
    END IF;
    IF ws_id IS NOT NULL THEN
      SELECT (wcp.credits_allocated - wcp.credits_assigned_out - wcp.credits_used_direct) INTO pool_rem
      FROM public.workspace_credit_pools wcp
      WHERE wcp.workspace_id = ws_id AND wcp.period = _period;
      IF pool_rem IS NOT NULL AND pool_rem > 0 THEN
        total_limit := (SELECT wcp.credits_allocated - wcp.credits_assigned_out FROM public.workspace_credit_pools wcp WHERE wcp.workspace_id = ws_id AND wcp.period = _period);
        total_used := (SELECT wcp.credits_used_direct FROM public.workspace_credit_pools wcp WHERE wcp.workspace_id = ws_id AND wcp.period = _period);
        source_type := 'workspace';
        source_id := ws_id;
      END IF;
    END IF;
  END IF;

  credits_limit := total_limit;
  credits_used := total_used;
  remaining := greatest(0, total_limit - total_used);
  RETURN NEXT;
  RETURN;
END;
$$;


ALTER FUNCTION "public"."get_credit_context"("_user_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."user_ai_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "month" "date" NOT NULL,
    "interactions_count" integer DEFAULT 0,
    "tokens_used" integer DEFAULT 0,
    "cost" numeric(10,6) DEFAULT 0,
    "limit_reached" boolean DEFAULT false,
    "usage_limit" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_ai_usage" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_ai_usage"("_user_id" "uuid", "_month" "date" DEFAULT ("date_trunc"('month'::"text", (CURRENT_DATE)::timestamp with time zone))::"date") RETURNS "public"."user_ai_usage"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  usage_record public.user_ai_usage;
  user_role app_role;
  usage_limit INTEGER;
BEGIN
  SELECT role INTO user_role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1;

  -- Token limits per month (not request count)
  usage_limit := CASE
    WHEN user_role = 'teacher' THEN 200000   -- 200k tokens
    WHEN user_role = 'student' THEN 100000   -- 100k tokens
    ELSE 10000                               -- 10k tokens free tier
  END;

  SELECT * INTO usage_record
  FROM public.user_ai_usage
  WHERE user_id = _user_id
  AND month = _month;

  IF usage_record IS NULL THEN
    INSERT INTO public.user_ai_usage (user_id, month, usage_limit)
    VALUES (_user_id, _month, usage_limit)
    RETURNING * INTO usage_record;
  END IF;

  RETURN usage_record;
END;
$$;


ALTER FUNCTION "public"."get_or_create_ai_usage"("_user_id" "uuid", "_month" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_role"("_user_id" "uuid") RETURNS "public"."app_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;


ALTER FUNCTION "public"."get_user_role"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  role_val text;
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email), NEW.email);

  role_val := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'role'), ''), 'admin');
  IF role_val NOT IN ('teacher', 'student', 'admin') THEN
    role_val := 'admin';
  END IF;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, role_val::public.app_role)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


ALTER FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_classroom_in_owner_workspace"("p_teacher_id" "uuid", "p_owner_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    JOIN public.workspaces w ON w.id = wm.workspace_id
    WHERE w.owner_id = p_owner_id
      AND wm.user_id = p_teacher_id
  );
$$;


ALTER FUNCTION "public"."is_classroom_in_owner_workspace"("p_teacher_id" "uuid", "p_owner_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_classroom_in_workspace"("p_classroom_id" "uuid", "p_workspace_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.classrooms c
    WHERE c.id = p_classroom_id
      AND c.workspace_id = p_workspace_id
  );
$$;


ALTER FUNCTION "public"."is_classroom_in_workspace"("p_classroom_id" "uuid", "p_workspace_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_classroom_owned_by_owner"("p_classroom_id" "uuid", "p_owner_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classrooms c
    JOIN public.workspaces w ON w.id = c.workspace_id
    WHERE c.id = p_classroom_id
      AND w.owner_id = p_owner_id
  );
$$;


ALTER FUNCTION "public"."is_classroom_owned_by_owner"("p_classroom_id" "uuid", "p_owner_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_classroom_teacher"("_user_id" "uuid", "_classroom_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.classrooms c
    WHERE c.id = _classroom_id
      AND c.teacher_id = _user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.classroom_tutors ct
    WHERE ct.classroom_id = _classroom_id
      AND ct.user_id = _user_id
  );
$$;


ALTER FUNCTION "public"."is_classroom_teacher"("_user_id" "uuid", "_classroom_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_document_shared_with_student"("p_doc_id" "uuid", "p_student_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.document_classroom_shares dcs
    JOIN public.enrollments e ON e.classroom_id = dcs.classroom_id
    WHERE dcs.document_id = p_doc_id
      AND e.student_id = p_student_id
      AND e.status = 'active'
  );
END;
$$;


ALTER FUNCTION "public"."is_document_shared_with_student"("p_doc_id" "uuid", "p_student_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_document_user_in_owner_workspace"("p_user_id" "uuid", "p_owner_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    JOIN public.workspaces w ON w.id = wm.workspace_id
    WHERE w.owner_id = p_owner_id
      AND wm.user_id = p_user_id
  );
$$;


ALTER FUNCTION "public"."is_document_user_in_owner_workspace"("p_user_id" "uuid", "p_owner_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_enrolled_in_classroom"("_user_id" "uuid", "_classroom_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.enrollments
    WHERE student_id = _user_id
      AND classroom_id = _classroom_id
      AND status = 'active'
  );
$$;


ALTER FUNCTION "public"."is_enrolled_in_classroom"("_user_id" "uuid", "_classroom_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_enrollment_classroom_in_owner_workspace"("p_classroom_id" "uuid", "p_owner_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classrooms c
    WHERE c.id = p_classroom_id
      AND (
        (c.workspace_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.workspaces w
          WHERE w.id = c.workspace_id AND w.owner_id = p_owner_id
        ))
        OR public.is_classroom_in_owner_workspace(c.teacher_id, p_owner_id)
      )
  );
$$;


ALTER FUNCTION "public"."is_enrollment_classroom_in_owner_workspace"("p_classroom_id" "uuid", "p_owner_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_storage_object_attached_to_assignment"("p_file_path" "text", "p_student_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.documents d
    JOIN public.assignment_attachments aa ON aa.document_id = d.id
    JOIN public.assignments a ON a.id = aa.assignment_id
    JOIN public.enrollments e ON e.classroom_id = a.classroom_id
    WHERE d.file_path = p_file_path
      AND a.status = 'published'
      AND e.student_id = p_student_id
      AND e.status = 'active'
  );
END;
$$;


ALTER FUNCTION "public"."is_storage_object_attached_to_assignment"("p_file_path" "text", "p_student_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_storage_object_shared_with_student"("p_file_path" "text", "p_student_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.documents d
    JOIN public.document_classroom_shares dcs ON dcs.document_id = d.id
    JOIN public.enrollments e ON e.classroom_id = dcs.classroom_id
    WHERE d.file_path = p_file_path
      AND e.student_id = p_student_id
      AND e.status = 'active'
  );
END;
$$;


ALTER FUNCTION "public"."is_storage_object_shared_with_student"("p_file_path" "text", "p_student_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_submission_in_owner_workspace"("p_assignment_id" "uuid", "p_owner_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id = p_assignment_id
      AND public.is_classroom_in_owner_workspace(a.teacher_id, p_owner_id)
  );
$$;


ALTER FUNCTION "public"."is_submission_in_owner_workspace"("p_assignment_id" "uuid", "p_owner_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_user_tutor_of_classroom"("p_user_id" "uuid", "p_classroom_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classrooms c
    WHERE c.id = p_classroom_id
      AND c.teacher_id = p_user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.classroom_tutors ct
    WHERE ct.classroom_id = p_classroom_id
      AND ct.user_id = p_user_id
  );
$$;


ALTER FUNCTION "public"."is_user_tutor_of_classroom"("p_user_id" "uuid", "p_classroom_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_workspace_member"("_workspace_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = _workspace_id AND wm.user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_workspace_member"("_workspace_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_workspace_owner"("_workspace_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = _workspace_id AND w.owner_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_workspace_owner"("_workspace_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."owner_can_insert_classroom"("p_workspace_id" "uuid", "p_teacher_id" "uuid", "p_owner_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = p_workspace_id
      AND w.owner_id = p_owner_id
  )
  AND EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = p_workspace_id
      AND wm.user_id = p_teacher_id
  );
$$;


ALTER FUNCTION "public"."owner_can_insert_classroom"("p_workspace_id" "uuid", "p_teacher_id" "uuid", "p_owner_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."owner_can_view_member_profile"("_member_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspaces w
    JOIN public.workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = _member_user_id
    WHERE w.owner_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."owner_can_view_member_profile"("_member_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."owner_can_view_student_profile"("_student_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tutor_student_assignments tsa
    JOIN public.workspaces w ON w.id = tsa.workspace_id
    WHERE tsa.student_id = _student_user_id AND w.owner_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."owner_can_view_student_profile"("_student_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_ai_interaction"("_user_id" "uuid", "_interaction_type" "text", "_provider" "text", "_model" "text", "_tokens_used" integer DEFAULT 0, "_cost" numeric DEFAULT 0, "_success" boolean DEFAULT true, "_error_message" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  interaction_id UUID;
  usage_record public.user_ai_usage;
  new_tokens_total INTEGER;
BEGIN
  INSERT INTO public.ai_interactions (
    user_id,
    interaction_type,
    provider,
    model,
    tokens_used,
    cost,
    success,
    error_message
  )
  VALUES (
    _user_id,
    _interaction_type,
    _provider,
    _model,
    _tokens_used,
    _cost,
    _success,
    _error_message
  )
  RETURNING id INTO interaction_id;

  IF _success THEN
    SELECT * INTO usage_record
    FROM public.get_or_create_ai_usage(_user_id);

    new_tokens_total := usage_record.tokens_used + _tokens_used;

    UPDATE public.user_ai_usage
    SET
      interactions_count = interactions_count + 1,
      tokens_used = tokens_used + _tokens_used,
      cost = cost + _cost,
      limit_reached = CASE
        WHEN usage_limit IS NOT NULL AND new_tokens_total >= usage_limit
        THEN true
        ELSE limit_reached
      END,
      updated_at = now()
    WHERE id = usage_record.id;
  END IF;

  RETURN interaction_id;
END;
$$;


ALTER FUNCTION "public"."record_ai_interaction"("_user_id" "uuid", "_interaction_type" "text", "_provider" "text", "_model" "text", "_tokens_used" integer, "_cost" numeric, "_success" boolean, "_error_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_subscription_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_subscription_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_tutor_contracts_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_tutor_contracts_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_workspaces_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_workspaces_updated_at"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quiz_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quiz_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "attempt_number" integer DEFAULT 1 NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "submitted_at" timestamp with time zone,
    "time_spent_seconds" integer,
    "answers" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "score" numeric(5,2),
    "points_earned" numeric(10,2),
    "points_possible" numeric(10,2),
    "status" "text" DEFAULT 'in_progress'::"text" NOT NULL,
    "auto_graded_at" timestamp with time zone,
    "manually_graded_at" timestamp with time zone,
    "feedback" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "quiz_attempts_status_check" CHECK (("status" = ANY (ARRAY['in_progress'::"text", 'submitted'::"text", 'graded'::"text"])))
);


ALTER TABLE "public"."quiz_attempts" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."start_quiz_attempt"("_quiz_id" "uuid", "_student_id" "uuid") RETURNS SETOF "public"."quiz_attempts"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  quiz_record RECORD;
  attempt_count INTEGER;
  next_attempt_number INTEGER;
  new_attempt public.quiz_attempts;
  lock_id BIGINT;
BEGIN
  -- Advisory lock per (quiz, student) so only one start_quiz_attempt runs at a time
  lock_id := ('x' || substr(md5(_quiz_id::text || _student_id::text), 1, 16))::bit(64)::bigint;
  PERFORM pg_advisory_xact_lock(lock_id);

  -- Get quiz details
  SELECT * INTO quiz_record
  FROM public.quizzes
  WHERE id = _quiz_id;

  IF quiz_record IS NULL THEN
    RAISE EXCEPTION 'Quiz not found';
  END IF;

  IF quiz_record.status NOT IN ('active', 'scheduled') THEN
    RAISE EXCEPTION 'Quiz is not active';
  END IF;

  IF quiz_record.available_from IS NOT NULL AND now() < quiz_record.available_from THEN
    RAISE EXCEPTION 'Quiz not yet available';
  END IF;

  IF quiz_record.available_until IS NOT NULL AND now() > quiz_record.available_until THEN
    RAISE EXCEPTION 'Quiz deadline has passed';
  END IF;

  -- Must not already have an in-progress attempt
  IF EXISTS (
    SELECT 1 FROM public.quiz_attempts
    WHERE quiz_id = _quiz_id AND student_id = _student_id AND status = 'in_progress'
  ) THEN
    RAISE EXCEPTION 'Quiz already in progress';
  END IF;

  -- Count all attempts (including in_progress) and enforce max_attempts
  SELECT COUNT(*) INTO attempt_count
  FROM public.quiz_attempts
  WHERE quiz_id = _quiz_id AND student_id = _student_id;

  IF quiz_record.max_attempts IS NOT NULL AND attempt_count >= quiz_record.max_attempts THEN
    RAISE EXCEPTION 'Maximum attempts reached';
  END IF;

  -- Next attempt number
  SELECT COALESCE(MAX(attempt_number), 0) + 1 INTO next_attempt_number
  FROM public.quiz_attempts
  WHERE quiz_id = _quiz_id AND student_id = _student_id;

  -- Insert and return the new attempt
  INSERT INTO public.quiz_attempts (quiz_id, student_id, attempt_number, status)
  VALUES (_quiz_id, _student_id, next_attempt_number, 'in_progress')
  RETURNING * INTO new_attempt;

  RETURN NEXT new_attempt;
END;
$$;


ALTER FUNCTION "public"."start_quiz_attempt"("_quiz_id" "uuid", "_student_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_assigned_credits"("_workspace_id" "uuid", "_member_user_id" "uuid", "_new_limit" integer, "_caller_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _period date := date_trunc('month', current_date)::date;
  pool record;
  is_caller_owner_or_tutor boolean := false;
  alloc record;
  delta integer;
BEGIN
  IF _new_limit IS NULL OR _new_limit < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid new limit');
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = _workspace_id AND w.owner_id = _caller_user_id)
    OR EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = _workspace_id AND wm.user_id = _caller_user_id)
  INTO is_caller_owner_or_tutor;
  IF NOT is_caller_owner_or_tutor THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not a workspace owner or member');
  END IF;

  SELECT credits_limit, credits_used INTO alloc FROM public.user_credit_allocations
  WHERE user_id = _member_user_id AND period = _period AND source_type = 'workspace' AND source_id = _workspace_id;

  IF alloc.credits_limit IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No allocation for this member');
  END IF;

  IF _new_limit < alloc.credits_used THEN
    RETURN jsonb_build_object('ok', false, 'error', 'New limit cannot be less than already used');
  END IF;

  delta := _new_limit - alloc.credits_limit;

  IF delta > 0 THEN
    SELECT wcp.credits_allocated, wcp.credits_assigned_out INTO pool
    FROM public.workspace_credit_pools wcp WHERE wcp.workspace_id = _workspace_id AND wcp.period = _period;
    IF pool.credits_allocated IS NOT NULL AND (pool.credits_allocated - pool.credits_assigned_out) < delta THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Insufficient credits in workspace pool');
    END IF;
    UPDATE public.workspace_credit_pools SET credits_assigned_out = credits_assigned_out + delta, updated_at = now()
    WHERE workspace_id = _workspace_id AND period = _period;
  ELSIF delta < 0 THEN
    UPDATE public.workspace_credit_pools SET credits_assigned_out = greatest(0, credits_assigned_out + delta), updated_at = now()
    WHERE workspace_id = _workspace_id AND period = _period;
  END IF;

  UPDATE public.user_credit_allocations SET credits_limit = _new_limit, updated_at = now()
  WHERE user_id = _member_user_id AND period = _period AND source_type = 'workspace' AND source_id = _workspace_id;

  INSERT INTO public.credit_assignments_audit (workspace_id, period, assigned_by_user_id, assigned_to_user_id, credits, action, previous_limit, new_limit)
  VALUES (_workspace_id, _period, _caller_user_id, _member_user_id, abs(delta), 'update', alloc.credits_limit, _new_limit);

  RETURN jsonb_build_object('ok', true, 'new_limit', _new_limit);
END;
$$;


ALTER FUNCTION "public"."update_assigned_credits"("_workspace_id" "uuid", "_member_user_id" "uuid", "_new_limit" integer, "_caller_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_assigned_storage_limit"("_workspace_id" "uuid", "_member_user_id" "uuid", "_new_limit_mb" integer, "_caller_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."update_assigned_storage_limit"("_workspace_id" "uuid", "_member_user_id" "uuid", "_new_limit_mb" integer, "_caller_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_user_credit_allocation_subscription"("_user_id" "uuid", "_period" "date", "_credits_limit" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.user_credit_allocations (user_id, period, source_type, source_id, credits_limit, credits_used)
  VALUES (_user_id, _period, 'subscription', _user_id, _credits_limit, 0)
  ON CONFLICT (user_id, period, source_type, source_id)
  DO UPDATE SET credits_limit = _credits_limit, updated_at = now();
END;
$$;


ALTER FUNCTION "public"."upsert_user_credit_allocation_subscription"("_user_id" "uuid", "_period" "date", "_credits_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_workspace_credit_pool"("_workspace_id" "uuid", "_period" "date", "_credits_allocated" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.workspace_credit_pools (workspace_id, period, credits_allocated, credits_assigned_out, credits_used_direct)
  VALUES (_workspace_id, _period, _credits_allocated, 0, 0)
  ON CONFLICT (workspace_id, period)
  DO UPDATE SET credits_allocated = _credits_allocated, updated_at = now();
END;
$$;


ALTER FUNCTION "public"."upsert_workspace_credit_pool"("_workspace_id" "uuid", "_period" "date", "_credits_allocated" integer) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "submission_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "feedback_data" "jsonb" NOT NULL,
    "suggestions" "jsonb",
    "consistency_hash" "text",
    "rubric_suggestions" "jsonb",
    "accepted" boolean DEFAULT false,
    "modified_feedback" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_generated_content" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "jsonb" NOT NULL,
    "source_materials" "jsonb",
    "metadata" "jsonb",
    "saved_to_documents" boolean DEFAULT false,
    "document_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_generated_content_content_type_check" CHECK (("content_type" = ANY (ARRAY['lesson_plan'::"text", 'syllabus_lesson_plan'::"text", 'worksheet'::"text", 'worksheet_builder'::"text", 'discussion_questions'::"text", 'project_ideas'::"text", 'rubric'::"text", 'paper'::"text", 'quiz_questions'::"text", 'study_notes'::"text", 'flashcards'::"text", 'practice_questions'::"text", 'summary'::"text", 'concept_explanation'::"text", 'study_plan'::"text"])))
);


ALTER TABLE "public"."ai_generated_content" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_interactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "interaction_type" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "model" "text" NOT NULL,
    "tokens_used" integer DEFAULT 0,
    "cost" numeric(10,6) DEFAULT 0,
    "request_data" "jsonb",
    "response_data" "jsonb",
    "success" boolean DEFAULT true,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "credits_deducted" integer DEFAULT 0,
    CONSTRAINT "ai_interactions_interaction_type_check" CHECK (("interaction_type" = ANY (ARRAY['content_generation'::"text", 'grading'::"text", 'lesson_planning'::"text", 'study_materials'::"text", 'rubric_generation'::"text", 'quiz_questions'::"text", 'differentiation'::"text", 'concept_explanation'::"text", 'practice_questions'::"text", 'flashcards'::"text", 'study_plan'::"text", 'worksheet_generation'::"text", 'paper_generation'::"text", 'checker'::"text", 'contract_generation'::"text", 'contract_revision'::"text"]))),
    CONSTRAINT "ai_interactions_provider_check" CHECK (("provider" = ANY (ARRAY['gemini'::"text", 'openai'::"text"])))
);


ALTER TABLE "public"."ai_interactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assignment_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "assignment_id" "uuid" NOT NULL,
    "document_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."assignment_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "classroom_id" "uuid" NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "instructions" "text",
    "due_date" timestamp with time zone,
    "points_possible" integer DEFAULT 100,
    "allow_late_submission" boolean DEFAULT true,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "assignments_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'closed'::"text", 'graded'::"text"])))
);


ALTER TABLE "public"."assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."checked_papers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "classroom_id" "uuid" NOT NULL,
    "student_id" "uuid",
    "title" "text" NOT NULL,
    "file_path" "text" NOT NULL,
    "grade" numeric(5,2),
    "feedback_text" "text",
    "instructions_used" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."checked_papers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."checker_presets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "instructions" "text" NOT NULL,
    "rubric_categories" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "total_points" integer DEFAULT 100 NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "reference_document_id" "uuid"
);


ALTER TABLE "public"."checker_presets" OWNER TO "postgres";


COMMENT ON COLUMN "public"."checker_presets"."reference_document_id" IS 'Optional reference document from Document Center (documents table) for grading context';



CREATE TABLE IF NOT EXISTS "public"."classroom_tutors" (
    "classroom_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."classroom_tutors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."classrooms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "subject" "text",
    "join_code" "text",
    "settings" "jsonb" DEFAULT '{"allow_late_submissions": true}'::"jsonb",
    "is_archived" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "workspace_id" "uuid"
);


ALTER TABLE "public"."classrooms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."credit_assignments_audit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "period" "date" NOT NULL,
    "assigned_by_user_id" "uuid" NOT NULL,
    "assigned_to_user_id" "uuid" NOT NULL,
    "credits" integer NOT NULL,
    "action" "text" NOT NULL,
    "previous_limit" integer,
    "new_limit" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "credit_assignments_audit_action_check" CHECK (("action" = ANY (ARRAY['assign'::"text", 'update'::"text"])))
);


ALTER TABLE "public"."credit_assignments_audit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."document_classroom_shares" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_id" "uuid" NOT NULL,
    "classroom_id" "uuid" NOT NULL,
    "shared_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."document_classroom_shares" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."document_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."document_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "folder_id" "uuid",
    "name" "text" NOT NULL,
    "file_path" "text" NOT NULL,
    "file_size" bigint DEFAULT 0 NOT NULL,
    "file_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."enrollments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "classroom_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "left_at" timestamp with time zone,
    CONSTRAINT "enrollments_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'left'::"text", 'removed'::"text"])))
);


ALTER TABLE "public"."enrollments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."folders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "parent_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."folders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."google_calendar_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "google_email" "text",
    "google_calendar_id" "text" DEFAULT 'primary'::"text" NOT NULL,
    "access_token" "text" NOT NULL,
    "refresh_token" "text",
    "token_type" "text",
    "scope" "text",
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."google_calendar_connections" OWNER TO "postgres";


COMMENT ON TABLE "public"."google_calendar_connections" IS 'Tutor-owned Google Calendar OAuth connection used to create Google Meet lecture sessions.';



CREATE TABLE IF NOT EXISTS "public"."planner_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "start_at" timestamp with time zone NOT NULL,
    "end_at" timestamp with time zone NOT NULL,
    "all_day" boolean DEFAULT false NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."planner_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."planner_events" IS 'Teacher lesson planner calendar events; AI-suggested events are added only after teacher review.';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "display_name" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email" "text",
    "account_type" "text",
    "onboarding_completed_at" timestamp with time zone,
    "bio" "text",
    "password_changed_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "profiles_account_type_check" CHECK ((("account_type" IS NULL) OR ("account_type" = ANY (ARRAY['business'::"text", 'student'::"text", 'tutor'::"text"]))))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."password_changed_at" IS 'When user last changed password; null for invited tutor/student until they complete change-password onboarding.';



CREATE TABLE IF NOT EXISTS "public"."quiz_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quiz_id" "uuid" NOT NULL,
    "question_type" "text" NOT NULL,
    "question_text" "text" NOT NULL,
    "points" numeric(5,2) DEFAULT 1.0 NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "options" "jsonb",
    "correct_answer" "text",
    "explanation" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "quiz_questions_question_type_check" CHECK (("question_type" = ANY (ARRAY['multiple_choice'::"text", 'true_false'::"text", 'short_answer'::"text"])))
);


ALTER TABLE "public"."quiz_questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quizzes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "classroom_id" "uuid" NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "instructions" "text",
    "time_limit_minutes" integer,
    "available_from" timestamp with time zone,
    "available_until" timestamp with time zone,
    "passing_score" numeric(5,2),
    "max_attempts" integer DEFAULT 1,
    "randomize_questions" boolean DEFAULT false,
    "show_correct_answers" boolean DEFAULT true,
    "show_results_immediately" boolean DEFAULT true,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "quizzes_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'scheduled'::"text", 'active'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."quizzes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_financial_mock" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "tutor_id" "uuid" NOT NULL,
    "tutor_rate_amount" numeric DEFAULT 0 NOT NULL,
    "tutor_rate_currency" "text" DEFAULT 'GBP'::"text" NOT NULL,
    "tutor_rate_type" "text" DEFAULT 'hourly'::"text" NOT NULL,
    "student_charge_amount" numeric DEFAULT 0 NOT NULL,
    "student_charge_currency" "text" DEFAULT 'GBP'::"text" NOT NULL,
    "student_charge_type" "text" DEFAULT 'per_session'::"text" NOT NULL,
    "created_by_user_id" "uuid" NOT NULL,
    "updated_by_user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "session_financial_mock_student_charge_type_check" CHECK (("student_charge_type" = ANY (ARRAY['hourly'::"text", 'per_session'::"text", 'per_student'::"text"]))),
    CONSTRAINT "session_financial_mock_tutor_rate_type_check" CHECK (("tutor_rate_type" = ANY (ARRAY['hourly'::"text", 'per_session'::"text"])))
);


ALTER TABLE "public"."session_financial_mock" OWNER TO "postgres";


COMMENT ON TABLE "public"."session_financial_mock" IS 'Mock-only pricing inputs used to derive payroll and revenue previews from completed sessions.';



CREATE TABLE IF NOT EXISTS "public"."session_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "tutor_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_by_user_id" "uuid" NOT NULL,
    "updated_by_user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."session_notes" OWNER TO "postgres";


COMMENT ON TABLE "public"."session_notes" IS 'Private tutor post-session notes. Visible to the assigned tutor and workspace owners, hidden from students.';



CREATE TABLE IF NOT EXISTS "public"."session_series" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "scope_type" "text" NOT NULL,
    "classroom_id" "uuid",
    "student_id" "uuid",
    "tutor_id" "uuid" NOT NULL,
    "created_by_user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone NOT NULL,
    "recurrence_frequency" "text" NOT NULL,
    "recurrence_interval" integer DEFAULT 1 NOT NULL,
    "occurrences_count" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "session_series_occurrences_count_check" CHECK (("occurrences_count" > 1)),
    CONSTRAINT "session_series_recurrence_frequency_check" CHECK (("recurrence_frequency" = ANY (ARRAY['daily'::"text", 'weekly'::"text"]))),
    CONSTRAINT "session_series_recurrence_interval_check" CHECK (("recurrence_interval" > 0)),
    CONSTRAINT "session_series_scope_target_check" CHECK (((("scope_type" = 'classroom'::"text") AND ("classroom_id" IS NOT NULL) AND ("student_id" IS NULL)) OR (("scope_type" = 'one_to_one'::"text") AND ("classroom_id" IS NULL) AND ("student_id" IS NOT NULL)))),
    CONSTRAINT "session_series_scope_type_check" CHECK (("scope_type" = ANY (ARRAY['classroom'::"text", 'one_to_one'::"text"]))),
    CONSTRAINT "session_series_time_order" CHECK (("ends_at" > "starts_at"))
);


ALTER TABLE "public"."session_series" OWNER TO "postgres";


COMMENT ON TABLE "public"."session_series" IS 'Recurring lecture series metadata used to generate concrete session rows.';



CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "classroom_id" "uuid",
    "tutor_id" "uuid" NOT NULL,
    "created_by_user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "meeting_provider" "text" DEFAULT 'google_meet'::"text" NOT NULL,
    "meeting_url" "text",
    "external_event_id" "text",
    "google_calendar_id" "text",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "scope_type" "text" DEFAULT 'classroom'::"text" NOT NULL,
    "student_id" "uuid",
    "series_id" "uuid",
    "occurrence_index" integer,
    CONSTRAINT "sessions_meeting_provider_check" CHECK (("meeting_provider" = ANY (ARRAY['google_meet'::"text", 'manual'::"text"]))),
    CONSTRAINT "sessions_scope_target_check" CHECK (((("scope_type" = 'classroom'::"text") AND ("classroom_id" IS NOT NULL) AND ("student_id" IS NULL)) OR (("scope_type" = 'one_to_one'::"text") AND ("classroom_id" IS NULL) AND ("student_id" IS NOT NULL)))),
    CONSTRAINT "sessions_scope_type_check" CHECK (("scope_type" = ANY (ARRAY['classroom'::"text", 'one_to_one'::"text"]))),
    CONSTRAINT "sessions_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'cancelled'::"text", 'completed'::"text"]))),
    CONSTRAINT "sessions_time_order" CHECK (("ends_at" > "starts_at"))
);


ALTER TABLE "public"."sessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."sessions" IS 'Scheduled classroom lecture sessions with optional Google Meet data.';



CREATE TABLE IF NOT EXISTS "public"."source_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "file_path" "text" NOT NULL,
    "file_type" "text" NOT NULL,
    "file_size" integer NOT NULL,
    "document_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "source_documents_document_type_check" CHECK (("document_type" = ANY (ARRAY['rubric'::"text", 'answer_key'::"text", 'example_paper'::"text", 'reference'::"text"])))
);


ALTER TABLE "public"."source_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "assignment_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "file_path" "text",
    "file_name" "text",
    "text_content" "text",
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_late" boolean DEFAULT false,
    "grade" numeric(5,2),
    "feedback" "text",
    "status" "text" DEFAULT 'submitted'::"text" NOT NULL,
    "graded_at" timestamp with time zone,
    "returned_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "submissions_status_check" CHECK (("status" = ANY (ARRAY['submitted'::"text", 'graded'::"text", 'returned'::"text"])))
);


ALTER TABLE "public"."submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" DEFAULT 'primary'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tutor_contracts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "tutor_id" "uuid" NOT NULL,
    "contract_status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "pay_type" "text" DEFAULT 'hourly'::"text" NOT NULL,
    "rate_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "rate_currency" "text" DEFAULT 'GBP'::"text" NOT NULL,
    "subjects" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "contract_body_text" "text",
    "contract_storage_path" "text",
    "contract_signed_at" timestamp with time zone,
    "tutor_signature_name" "text",
    "change_requested_at" timestamp with time zone,
    "change_request_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tutor_contracts_contract_status_check" CHECK (("contract_status" = ANY (ARRAY['draft'::"text", 'pending_signature'::"text", 'signed'::"text", 'change_requested'::"text"]))),
    CONSTRAINT "tutor_contracts_pay_type_check" CHECK (("pay_type" = ANY (ARRAY['hourly'::"text", 'per_session'::"text"])))
);


ALTER TABLE "public"."tutor_contracts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tutor_student_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "tutor_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tutor_student_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_credit_allocations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "period" "date" NOT NULL,
    "source_type" "text" NOT NULL,
    "source_id" "uuid" NOT NULL,
    "credits_limit" integer DEFAULT 0 NOT NULL,
    "credits_used" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_credit_allocations_source_type_check" CHECK (("source_type" = ANY (ARRAY['subscription'::"text", 'workspace'::"text"])))
);


ALTER TABLE "public"."user_credit_allocations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_storage_allocations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "storage_limit_mb" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_storage_allocations_storage_limit_mb_check" CHECK (("storage_limit_mb" >= 0))
);


ALTER TABLE "public"."user_storage_allocations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "paddle_subscription_id" "text",
    "paddle_customer_id" "text",
    "price_id" "text",
    "status" "text" DEFAULT 'inactive'::"text" NOT NULL,
    "current_period_ends_at" timestamp with time zone,
    "trial_ends_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "doc_storage_limit_mb" integer,
    CONSTRAINT "user_subscriptions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'trialing'::"text", 'past_due'::"text", 'canceled'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."user_subscriptions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."user_subscriptions"."doc_storage_limit_mb" IS 'Max Doc Center storage in MB; from Paddle product custom_data.doc_storage (GB).';



CREATE TABLE IF NOT EXISTS "public"."workspace_credit_pools" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "period" "date" NOT NULL,
    "credits_allocated" integer DEFAULT 0 NOT NULL,
    "credits_assigned_out" integer DEFAULT 0 NOT NULL,
    "credits_used_direct" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."workspace_credit_pools" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspace_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "workspace_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'tutor'::"text"])))
);


ALTER TABLE "public"."workspace_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspace_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "paddle_subscription_id" "text",
    "paddle_customer_id" "text",
    "price_id" "text",
    "status" "text" DEFAULT 'inactive'::"text" NOT NULL,
    "current_period_ends_at" timestamp with time zone,
    "trial_ends_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "doc_storage_limit_mb" integer,
    CONSTRAINT "workspace_subscriptions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'trialing'::"text", 'past_due'::"text", 'canceled'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."workspace_subscriptions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."workspace_subscriptions"."doc_storage_limit_mb" IS 'Max Doc Center storage in MB; from Paddle product custom_data.doc_storage (GB).';



CREATE TABLE IF NOT EXISTS "public"."workspaces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "trial_ends_at" timestamp with time zone,
    "logo_url" "text",
    CONSTRAINT "workspaces_type_check" CHECK (("type" = ANY (ARRAY['business'::"text", 'solo'::"text"])))
);


ALTER TABLE "public"."workspaces" OWNER TO "postgres";


ALTER TABLE ONLY "public"."ai_feedback"
    ADD CONSTRAINT "ai_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_generated_content"
    ADD CONSTRAINT "ai_generated_content_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_interactions"
    ADD CONSTRAINT "ai_interactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assignment_attachments"
    ADD CONSTRAINT "assignment_attachments_assignment_id_document_id_key" UNIQUE ("assignment_id", "document_id");



ALTER TABLE ONLY "public"."assignment_attachments"
    ADD CONSTRAINT "assignment_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."checked_papers"
    ADD CONSTRAINT "checked_papers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."checker_presets"
    ADD CONSTRAINT "checker_presets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classroom_tutors"
    ADD CONSTRAINT "classroom_tutors_pkey" PRIMARY KEY ("classroom_id", "user_id");



ALTER TABLE ONLY "public"."classrooms"
    ADD CONSTRAINT "classrooms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_assignments_audit"
    ADD CONSTRAINT "credit_assignments_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_classroom_shares"
    ADD CONSTRAINT "document_classroom_shares_document_id_classroom_id_key" UNIQUE ("document_id", "classroom_id");



ALTER TABLE ONLY "public"."document_classroom_shares"
    ADD CONSTRAINT "document_classroom_shares_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_tags"
    ADD CONSTRAINT "document_tags_document_id_tag_id_key" UNIQUE ("document_id", "tag_id");



ALTER TABLE ONLY "public"."document_tags"
    ADD CONSTRAINT "document_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_classroom_id_student_id_key" UNIQUE ("classroom_id", "student_id");



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."folders"
    ADD CONSTRAINT "folders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."google_calendar_connections"
    ADD CONSTRAINT "google_calendar_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."google_calendar_connections"
    ADD CONSTRAINT "google_calendar_connections_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."planner_events"
    ADD CONSTRAINT "planner_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."quiz_attempts"
    ADD CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quiz_questions"
    ADD CONSTRAINT "quiz_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quizzes"
    ADD CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_financial_mock"
    ADD CONSTRAINT "session_financial_mock_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_financial_mock"
    ADD CONSTRAINT "session_financial_mock_session_id_key" UNIQUE ("session_id");



ALTER TABLE ONLY "public"."session_notes"
    ADD CONSTRAINT "session_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_notes"
    ADD CONSTRAINT "session_notes_session_id_key" UNIQUE ("session_id");



ALTER TABLE ONLY "public"."session_series"
    ADD CONSTRAINT "session_series_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."source_documents"
    ADD CONSTRAINT "source_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_assignment_id_student_id_key" UNIQUE ("assignment_id", "student_id");



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_user_id_name_key" UNIQUE ("user_id", "name");



ALTER TABLE ONLY "public"."tutor_contracts"
    ADD CONSTRAINT "tutor_contracts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tutor_contracts"
    ADD CONSTRAINT "tutor_contracts_workspace_id_tutor_id_key" UNIQUE ("workspace_id", "tutor_id");



ALTER TABLE ONLY "public"."tutor_student_assignments"
    ADD CONSTRAINT "tutor_student_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tutor_student_assignments"
    ADD CONSTRAINT "tutor_student_assignments_workspace_id_student_id_key" UNIQUE ("workspace_id", "student_id");



ALTER TABLE ONLY "public"."user_ai_usage"
    ADD CONSTRAINT "user_ai_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_ai_usage"
    ADD CONSTRAINT "user_ai_usage_user_id_month_key" UNIQUE ("user_id", "month");



ALTER TABLE ONLY "public"."user_credit_allocations"
    ADD CONSTRAINT "user_credit_allocations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_credit_allocations"
    ADD CONSTRAINT "user_credit_allocations_user_id_period_source_type_source_i_key" UNIQUE ("user_id", "period", "source_type", "source_id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_storage_allocations"
    ADD CONSTRAINT "user_storage_allocations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_storage_allocations"
    ADD CONSTRAINT "user_storage_allocations_workspace_id_user_id_key" UNIQUE ("workspace_id", "user_id");



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."workspace_credit_pools"
    ADD CONSTRAINT "workspace_credit_pools_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspace_credit_pools"
    ADD CONSTRAINT "workspace_credit_pools_workspace_id_period_key" UNIQUE ("workspace_id", "period");



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_workspace_id_user_id_key" UNIQUE ("workspace_id", "user_id");



ALTER TABLE ONLY "public"."workspace_subscriptions"
    ADD CONSTRAINT "workspace_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspace_subscriptions"
    ADD CONSTRAINT "workspace_subscriptions_workspace_id_key" UNIQUE ("workspace_id");



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_ai_feedback_submission_id" ON "public"."ai_feedback" USING "btree" ("submission_id");



CREATE INDEX "idx_ai_feedback_user_id" ON "public"."ai_feedback" USING "btree" ("user_id");



CREATE INDEX "idx_ai_generated_content_type" ON "public"."ai_generated_content" USING "btree" ("content_type");



CREATE INDEX "idx_ai_generated_content_user_id" ON "public"."ai_generated_content" USING "btree" ("user_id");



CREATE INDEX "idx_ai_interactions_created_at" ON "public"."ai_interactions" USING "btree" ("created_at");



CREATE INDEX "idx_ai_interactions_type" ON "public"."ai_interactions" USING "btree" ("interaction_type");



CREATE INDEX "idx_ai_interactions_user_id" ON "public"."ai_interactions" USING "btree" ("user_id");



CREATE INDEX "idx_assignments_classroom_id" ON "public"."assignments" USING "btree" ("classroom_id");



CREATE INDEX "idx_assignments_teacher_id" ON "public"."assignments" USING "btree" ("teacher_id");



CREATE INDEX "idx_checked_papers_classroom" ON "public"."checked_papers" USING "btree" ("classroom_id");



CREATE INDEX "idx_checked_papers_student" ON "public"."checked_papers" USING "btree" ("student_id");



CREATE INDEX "idx_checked_papers_teacher" ON "public"."checked_papers" USING "btree" ("teacher_id");



CREATE INDEX "idx_checker_presets_created_at" ON "public"."checker_presets" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_checker_presets_teacher_id" ON "public"."checker_presets" USING "btree" ("teacher_id");



CREATE INDEX "idx_classroom_tutors_classroom_id" ON "public"."classroom_tutors" USING "btree" ("classroom_id");



CREATE INDEX "idx_classroom_tutors_user_id" ON "public"."classroom_tutors" USING "btree" ("user_id");



CREATE INDEX "idx_classrooms_join_code" ON "public"."classrooms" USING "btree" ("join_code");



CREATE INDEX "idx_classrooms_teacher_id" ON "public"."classrooms" USING "btree" ("teacher_id");



CREATE INDEX "idx_classrooms_workspace_id" ON "public"."classrooms" USING "btree" ("workspace_id");



CREATE INDEX "idx_credit_assignments_audit_assigned_to" ON "public"."credit_assignments_audit" USING "btree" ("assigned_to_user_id", "created_at");



CREATE INDEX "idx_credit_assignments_audit_workspace_period" ON "public"."credit_assignments_audit" USING "btree" ("workspace_id", "period");



CREATE INDEX "idx_document_classroom_shares_classroom_id" ON "public"."document_classroom_shares" USING "btree" ("classroom_id");



CREATE INDEX "idx_document_classroom_shares_document_id" ON "public"."document_classroom_shares" USING "btree" ("document_id");



CREATE INDEX "idx_enrollments_classroom_id" ON "public"."enrollments" USING "btree" ("classroom_id");



CREATE INDEX "idx_enrollments_student_id" ON "public"."enrollments" USING "btree" ("student_id");



CREATE INDEX "idx_google_calendar_connections_user_id" ON "public"."google_calendar_connections" USING "btree" ("user_id");



CREATE INDEX "idx_planner_events_teacher_start" ON "public"."planner_events" USING "btree" ("teacher_id", "start_at");



CREATE INDEX "idx_quiz_attempts_quiz_id" ON "public"."quiz_attempts" USING "btree" ("quiz_id");



CREATE INDEX "idx_quiz_attempts_status" ON "public"."quiz_attempts" USING "btree" ("status");



CREATE INDEX "idx_quiz_attempts_student_id" ON "public"."quiz_attempts" USING "btree" ("student_id");



CREATE INDEX "idx_quiz_questions_quiz_id" ON "public"."quiz_questions" USING "btree" ("quiz_id");



CREATE INDEX "idx_quizzes_classroom_id" ON "public"."quizzes" USING "btree" ("classroom_id");



CREATE INDEX "idx_quizzes_status" ON "public"."quizzes" USING "btree" ("status");



CREATE INDEX "idx_quizzes_teacher_id" ON "public"."quizzes" USING "btree" ("teacher_id");



CREATE INDEX "idx_session_financial_mock_tutor_id" ON "public"."session_financial_mock" USING "btree" ("tutor_id");



CREATE INDEX "idx_session_financial_mock_workspace_id" ON "public"."session_financial_mock" USING "btree" ("workspace_id");



CREATE INDEX "idx_session_notes_tutor_id" ON "public"."session_notes" USING "btree" ("tutor_id");



CREATE INDEX "idx_session_notes_workspace_id" ON "public"."session_notes" USING "btree" ("workspace_id");



CREATE INDEX "idx_session_series_workspace_id" ON "public"."session_series" USING "btree" ("workspace_id");



CREATE INDEX "idx_sessions_classroom_starts_at" ON "public"."sessions" USING "btree" ("classroom_id", "starts_at");



CREATE INDEX "idx_sessions_series_occurrence" ON "public"."sessions" USING "btree" ("series_id", "occurrence_index");



CREATE INDEX "idx_sessions_student_starts_at" ON "public"."sessions" USING "btree" ("student_id", "starts_at");



CREATE INDEX "idx_sessions_tutor_starts_at" ON "public"."sessions" USING "btree" ("tutor_id", "starts_at");



CREATE INDEX "idx_sessions_workspace_starts_at" ON "public"."sessions" USING "btree" ("workspace_id", "starts_at");



CREATE INDEX "idx_source_documents_created_at" ON "public"."source_documents" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_source_documents_document_type" ON "public"."source_documents" USING "btree" ("document_type");



CREATE INDEX "idx_source_documents_teacher_id" ON "public"."source_documents" USING "btree" ("teacher_id");



CREATE INDEX "idx_submissions_assignment_id" ON "public"."submissions" USING "btree" ("assignment_id");



CREATE INDEX "idx_submissions_student_id" ON "public"."submissions" USING "btree" ("student_id");



CREATE INDEX "idx_tsa_student_id" ON "public"."tutor_student_assignments" USING "btree" ("student_id");



CREATE INDEX "idx_tsa_tutor_id" ON "public"."tutor_student_assignments" USING "btree" ("tutor_id");



CREATE INDEX "idx_tsa_workspace_id" ON "public"."tutor_student_assignments" USING "btree" ("workspace_id");



CREATE INDEX "idx_tutor_contracts_tutor_id" ON "public"."tutor_contracts" USING "btree" ("tutor_id");



CREATE INDEX "idx_tutor_contracts_workspace_id" ON "public"."tutor_contracts" USING "btree" ("workspace_id");



CREATE INDEX "idx_user_ai_usage_month" ON "public"."user_ai_usage" USING "btree" ("month");



CREATE INDEX "idx_user_ai_usage_user_id" ON "public"."user_ai_usage" USING "btree" ("user_id");



CREATE INDEX "idx_user_credit_allocations_user_period" ON "public"."user_credit_allocations" USING "btree" ("user_id", "period");



CREATE INDEX "idx_user_storage_allocations_user_id" ON "public"."user_storage_allocations" USING "btree" ("user_id");



CREATE INDEX "idx_user_storage_allocations_workspace_id" ON "public"."user_storage_allocations" USING "btree" ("workspace_id");



CREATE INDEX "idx_user_subscriptions_paddle_sub_id" ON "public"."user_subscriptions" USING "btree" ("paddle_subscription_id") WHERE ("paddle_subscription_id" IS NOT NULL);



CREATE INDEX "idx_user_subscriptions_user_id" ON "public"."user_subscriptions" USING "btree" ("user_id");



CREATE INDEX "idx_workspace_credit_pools_workspace_period" ON "public"."workspace_credit_pools" USING "btree" ("workspace_id", "period");



CREATE INDEX "idx_workspace_members_user_id" ON "public"."workspace_members" USING "btree" ("user_id");



CREATE INDEX "idx_workspace_members_workspace_id" ON "public"."workspace_members" USING "btree" ("workspace_id");



CREATE INDEX "idx_workspace_subscriptions_paddle_sub_id" ON "public"."workspace_subscriptions" USING "btree" ("paddle_subscription_id") WHERE ("paddle_subscription_id" IS NOT NULL);



CREATE INDEX "idx_workspace_subscriptions_workspace_id" ON "public"."workspace_subscriptions" USING "btree" ("workspace_id");



CREATE INDEX "idx_workspaces_owner_id" ON "public"."workspaces" USING "btree" ("owner_id");



CREATE OR REPLACE TRIGGER "update_ai_feedback_updated_at" BEFORE UPDATE ON "public"."ai_feedback" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "update_ai_generated_content_updated_at" BEFORE UPDATE ON "public"."ai_generated_content" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "update_assignments_updated_at" BEFORE UPDATE ON "public"."assignments" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "update_classrooms_updated_at" BEFORE UPDATE ON "public"."classrooms" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "update_documents_updated_at" BEFORE UPDATE ON "public"."documents" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "update_folders_updated_at" BEFORE UPDATE ON "public"."folders" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "update_quiz_attempts_updated_at" BEFORE UPDATE ON "public"."quiz_attempts" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "update_quizzes_updated_at" BEFORE UPDATE ON "public"."quizzes" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "update_submissions_updated_at" BEFORE UPDATE ON "public"."submissions" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "update_tutor_contracts_updated_at" BEFORE UPDATE ON "public"."tutor_contracts" FOR EACH ROW EXECUTE FUNCTION "public"."set_tutor_contracts_updated_at"();



CREATE OR REPLACE TRIGGER "update_user_ai_usage_updated_at" BEFORE UPDATE ON "public"."user_ai_usage" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "update_user_subscriptions_updated_at" BEFORE UPDATE ON "public"."user_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."set_subscription_updated_at"();



CREATE OR REPLACE TRIGGER "update_workspace_subscriptions_updated_at" BEFORE UPDATE ON "public"."workspace_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."set_subscription_updated_at"();



CREATE OR REPLACE TRIGGER "update_workspaces_updated_at" BEFORE UPDATE ON "public"."workspaces" FOR EACH ROW EXECUTE FUNCTION "public"."set_workspaces_updated_at"();



ALTER TABLE ONLY "public"."ai_feedback"
    ADD CONSTRAINT "ai_feedback_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_feedback"
    ADD CONSTRAINT "ai_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_generated_content"
    ADD CONSTRAINT "ai_generated_content_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_generated_content"
    ADD CONSTRAINT "ai_generated_content_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_interactions"
    ADD CONSTRAINT "ai_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignment_attachments"
    ADD CONSTRAINT "assignment_attachments_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignment_attachments"
    ADD CONSTRAINT "assignment_attachments_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."checked_papers"
    ADD CONSTRAINT "checked_papers_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."checked_papers"
    ADD CONSTRAINT "checked_papers_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."checked_papers"
    ADD CONSTRAINT "checked_papers_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."checker_presets"
    ADD CONSTRAINT "checker_presets_reference_document_id_fkey" FOREIGN KEY ("reference_document_id") REFERENCES "public"."documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."checker_presets"
    ADD CONSTRAINT "checker_presets_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classroom_tutors"
    ADD CONSTRAINT "classroom_tutors_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classroom_tutors"
    ADD CONSTRAINT "classroom_tutors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classrooms"
    ADD CONSTRAINT "classrooms_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classrooms"
    ADD CONSTRAINT "classrooms_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."credit_assignments_audit"
    ADD CONSTRAINT "credit_assignments_audit_assigned_by_user_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credit_assignments_audit"
    ADD CONSTRAINT "credit_assignments_audit_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credit_assignments_audit"
    ADD CONSTRAINT "credit_assignments_audit_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_classroom_shares"
    ADD CONSTRAINT "document_classroom_shares_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_classroom_shares"
    ADD CONSTRAINT "document_classroom_shares_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_tags"
    ADD CONSTRAINT "document_tags_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_tags"
    ADD CONSTRAINT "document_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "fk_submissions_student_profile" FOREIGN KEY ("student_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."folders"
    ADD CONSTRAINT "folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."folders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."google_calendar_connections"
    ADD CONSTRAINT "google_calendar_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planner_events"
    ADD CONSTRAINT "planner_events_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quiz_attempts"
    ADD CONSTRAINT "quiz_attempts_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quiz_attempts"
    ADD CONSTRAINT "quiz_attempts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quiz_questions"
    ADD CONSTRAINT "quiz_questions_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quizzes"
    ADD CONSTRAINT "quizzes_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quizzes"
    ADD CONSTRAINT "quizzes_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_financial_mock"
    ADD CONSTRAINT "session_financial_mock_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_financial_mock"
    ADD CONSTRAINT "session_financial_mock_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_financial_mock"
    ADD CONSTRAINT "session_financial_mock_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_financial_mock"
    ADD CONSTRAINT "session_financial_mock_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_financial_mock"
    ADD CONSTRAINT "session_financial_mock_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_notes"
    ADD CONSTRAINT "session_notes_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_notes"
    ADD CONSTRAINT "session_notes_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_notes"
    ADD CONSTRAINT "session_notes_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_notes"
    ADD CONSTRAINT "session_notes_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_notes"
    ADD CONSTRAINT "session_notes_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_series"
    ADD CONSTRAINT "session_series_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_series"
    ADD CONSTRAINT "session_series_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_series"
    ADD CONSTRAINT "session_series_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_series"
    ADD CONSTRAINT "session_series_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_series"
    ADD CONSTRAINT "session_series_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "public"."session_series"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."source_documents"
    ADD CONSTRAINT "source_documents_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tutor_contracts"
    ADD CONSTRAINT "tutor_contracts_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tutor_contracts"
    ADD CONSTRAINT "tutor_contracts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tutor_student_assignments"
    ADD CONSTRAINT "tutor_student_assignments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tutor_student_assignments"
    ADD CONSTRAINT "tutor_student_assignments_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tutor_student_assignments"
    ADD CONSTRAINT "tutor_student_assignments_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_ai_usage"
    ADD CONSTRAINT "user_ai_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_credit_allocations"
    ADD CONSTRAINT "user_credit_allocations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_storage_allocations"
    ADD CONSTRAINT "user_storage_allocations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_storage_allocations"
    ADD CONSTRAINT "user_storage_allocations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_credit_pools"
    ADD CONSTRAINT "workspace_credit_pools_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_subscriptions"
    ADD CONSTRAINT "workspace_subscriptions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Owners and tutor can view tutor_student_assignments" ON "public"."tutor_student_assignments" FOR SELECT USING ((("tutor_id" = "auth"."uid"()) OR "public"."is_workspace_owner"("workspace_id")));



CREATE POLICY "Owners can delete session financial mock in workspace" ON "public"."session_financial_mock" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."sessions" "s"
  WHERE (("s"."id" = "session_financial_mock"."session_id") AND "public"."is_workspace_owner"("s"."workspace_id")))));



CREATE POLICY "Owners can delete session series in workspace" ON "public"."session_series" FOR DELETE USING ("public"."is_workspace_owner"("workspace_id"));



CREATE POLICY "Owners can delete sessions in their workspace" ON "public"."sessions" FOR DELETE USING ("public"."is_workspace_owner"("workspace_id"));



CREATE POLICY "Owners can delete workspace members" ON "public"."workspace_members" FOR DELETE USING ("public"."is_workspace_owner"("workspace_id"));



CREATE POLICY "Owners can insert classrooms in their workspace" ON "public"."classrooms" FOR INSERT WITH CHECK ((("workspace_id" IS NOT NULL) AND "public"."owner_can_insert_classroom"("workspace_id", "teacher_id", "auth"."uid"())));



CREATE POLICY "Owners can insert enrollments in their workspace" ON "public"."enrollments" FOR INSERT WITH CHECK ("public"."is_enrollment_classroom_in_owner_workspace"("classroom_id", "auth"."uid"()));



CREATE POLICY "Owners can insert session financial mock in workspace" ON "public"."session_financial_mock" FOR INSERT WITH CHECK ((("created_by_user_id" = "auth"."uid"()) AND ("updated_by_user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."sessions" "s"
  WHERE (("s"."id" = "session_financial_mock"."session_id") AND ("s"."workspace_id" = "session_financial_mock"."workspace_id") AND ("s"."tutor_id" = "session_financial_mock"."tutor_id") AND "public"."is_workspace_owner"("s"."workspace_id"))))));



CREATE POLICY "Owners can insert session series in workspace" ON "public"."session_series" FOR INSERT WITH CHECK (("public"."is_workspace_owner"("workspace_id") AND ((("scope_type" = 'classroom'::"text") AND ("classroom_id" IS NOT NULL) AND "public"."is_classroom_in_workspace"("classroom_id", "workspace_id") AND "public"."is_user_tutor_of_classroom"("tutor_id", "classroom_id")) OR (("scope_type" = 'one_to_one'::"text") AND ("student_id" IS NOT NULL) AND "public"."can_manage_student_assignment"("student_id", "tutor_id", "workspace_id")))));



CREATE POLICY "Owners can insert sessions in their workspace" ON "public"."sessions" FOR INSERT WITH CHECK (("public"."is_workspace_owner"("workspace_id") AND ((("scope_type" = 'classroom'::"text") AND ("classroom_id" IS NOT NULL) AND "public"."is_classroom_in_workspace"("classroom_id", "workspace_id") AND "public"."is_user_tutor_of_classroom"("tutor_id", "classroom_id")) OR (("scope_type" = 'one_to_one'::"text") AND ("student_id" IS NOT NULL) AND "public"."can_manage_student_assignment"("student_id", "tutor_id", "workspace_id")))));



CREATE POLICY "Owners can insert workspace members" ON "public"."workspace_members" FOR INSERT WITH CHECK ("public"."is_workspace_owner"("workspace_id"));



CREATE POLICY "Owners can manage classroom_tutors in their workspace" ON "public"."classroom_tutors" USING ((EXISTS ( SELECT 1
   FROM ("public"."classrooms" "c"
     JOIN "public"."workspaces" "w" ON (("w"."id" = "c"."workspace_id")))
  WHERE (("c"."id" = "classroom_tutors"."classroom_id") AND ("w"."owner_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."classrooms" "c"
     JOIN "public"."workspaces" "w" ON (("w"."id" = "c"."workspace_id")))
  WHERE (("c"."id" = "classroom_tutors"."classroom_id") AND ("w"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Owners can manage own workspace" ON "public"."workspaces" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "Owners can manage tutor_contracts in their workspace" ON "public"."tutor_contracts" USING ((EXISTS ( SELECT 1
   FROM "public"."workspaces" "w"
  WHERE (("w"."id" = "tutor_contracts"."workspace_id") AND ("w"."owner_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."workspaces" "w"
  WHERE (("w"."id" = "tutor_contracts"."workspace_id") AND ("w"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Owners can manage tutor_student_assignments" ON "public"."tutor_student_assignments" USING ("public"."is_workspace_owner"("workspace_id")) WITH CHECK ("public"."is_workspace_owner"("workspace_id"));



CREATE POLICY "Owners can update classrooms in their workspace" ON "public"."classrooms" FOR UPDATE USING ("public"."is_classroom_owned_by_owner"("id", "auth"."uid"())) WITH CHECK ("public"."is_classroom_owned_by_owner"("id", "auth"."uid"()));



CREATE POLICY "Owners can update enrollments in their workspace" ON "public"."enrollments" FOR UPDATE USING ("public"."is_enrollment_classroom_in_owner_workspace"("classroom_id", "auth"."uid"())) WITH CHECK ("public"."is_enrollment_classroom_in_owner_workspace"("classroom_id", "auth"."uid"()));



CREATE POLICY "Owners can update session financial mock in workspace" ON "public"."session_financial_mock" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."sessions" "s"
  WHERE (("s"."id" = "session_financial_mock"."session_id") AND "public"."is_workspace_owner"("s"."workspace_id"))))) WITH CHECK ((("updated_by_user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."sessions" "s"
  WHERE (("s"."id" = "session_financial_mock"."session_id") AND ("s"."workspace_id" = "session_financial_mock"."workspace_id") AND ("s"."tutor_id" = "session_financial_mock"."tutor_id") AND "public"."is_workspace_owner"("s"."workspace_id"))))));



CREATE POLICY "Owners can update session series in workspace" ON "public"."session_series" FOR UPDATE USING ("public"."is_workspace_owner"("workspace_id")) WITH CHECK ("public"."is_workspace_owner"("workspace_id"));



CREATE POLICY "Owners can update sessions in their workspace" ON "public"."sessions" FOR UPDATE USING ("public"."is_workspace_owner"("workspace_id")) WITH CHECK ("public"."is_workspace_owner"("workspace_id"));



CREATE POLICY "Owners can update their workspace" ON "public"."workspaces" FOR UPDATE USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "Owners can update workspace members" ON "public"."workspace_members" FOR UPDATE USING ("public"."is_workspace_owner"("workspace_id"));



CREATE POLICY "Owners can view assignments in their workspace" ON "public"."assignments" FOR SELECT USING ("public"."is_classroom_in_owner_workspace"("teacher_id", "auth"."uid"()));



CREATE POLICY "Owners can view classrooms in their workspace" ON "public"."classrooms" FOR SELECT USING ((("workspace_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."workspaces" "w"
  WHERE (("w"."id" = "classrooms"."workspace_id") AND ("w"."owner_id" = "auth"."uid"()))))));



CREATE POLICY "Owners can view documents in their workspace" ON "public"."documents" FOR SELECT USING ("public"."is_document_user_in_owner_workspace"("user_id", "auth"."uid"()));



CREATE POLICY "Owners can view enrollments in their workspace" ON "public"."enrollments" FOR SELECT USING ("public"."is_enrollment_classroom_in_owner_workspace"("classroom_id", "auth"."uid"()));



CREATE POLICY "Owners can view private session notes in workspace" ON "public"."session_notes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."sessions" "s"
  WHERE (("s"."id" = "session_notes"."session_id") AND "public"."is_workspace_owner"("s"."workspace_id")))));



CREATE POLICY "Owners can view quizzes in their workspace" ON "public"."quizzes" FOR SELECT USING ("public"."is_classroom_in_owner_workspace"("teacher_id", "auth"."uid"()));



CREATE POLICY "Owners can view session financial mock in workspace" ON "public"."session_financial_mock" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."sessions" "s"
  WHERE (("s"."id" = "session_financial_mock"."session_id") AND "public"."is_workspace_owner"("s"."workspace_id")))));



CREATE POLICY "Owners can view session series in their workspace" ON "public"."session_series" FOR SELECT USING ("public"."is_workspace_owner"("workspace_id"));



CREATE POLICY "Owners can view sessions in their workspace" ON "public"."sessions" FOR SELECT USING ("public"."is_workspace_owner"("workspace_id"));



CREATE POLICY "Owners can view submissions in their workspace" ON "public"."submissions" FOR SELECT USING ("public"."is_submission_in_owner_workspace"("assignment_id", "auth"."uid"()));



CREATE POLICY "Students can leave classrooms" ON "public"."enrollments" FOR UPDATE USING (("student_id" = "auth"."uid"())) WITH CHECK (("student_id" = "auth"."uid"()));



CREATE POLICY "Students can start quiz attempts" ON "public"."quiz_attempts" FOR INSERT WITH CHECK ((("student_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM ("public"."quizzes" "q"
     JOIN "public"."enrollments" "e" ON (("e"."classroom_id" = "q"."classroom_id")))
  WHERE (("q"."id" = "quiz_attempts"."quiz_id") AND ("q"."status" = 'active'::"text") AND ("e"."student_id" = "auth"."uid"()) AND ("e"."status" = 'active'::"text"))))));



CREATE POLICY "Students can submit assignments" ON "public"."submissions" FOR INSERT WITH CHECK ((("student_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM ("public"."assignments" "a"
     JOIN "public"."enrollments" "e" ON (("e"."classroom_id" = "a"."classroom_id")))
  WHERE (("a"."id" = "submissions"."assignment_id") AND ("a"."status" = 'published'::"text") AND ("e"."student_id" = "auth"."uid"()) AND ("e"."status" = 'active'::"text"))))));



CREATE POLICY "Students can update their own quiz attempts" ON "public"."quiz_attempts" FOR UPDATE USING (("student_id" = "auth"."uid"())) WITH CHECK (("student_id" = "auth"."uid"()));



CREATE POLICY "Students can update their own submissions" ON "public"."submissions" FOR UPDATE USING (("student_id" = "auth"."uid"())) WITH CHECK (("student_id" = "auth"."uid"()));



CREATE POLICY "Students can view assignment attachments" ON "public"."assignment_attachments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."assignments" "a"
     JOIN "public"."enrollments" "e" ON (("e"."classroom_id" = "a"."classroom_id")))
  WHERE (("a"."id" = "assignment_attachments"."assignment_id") AND ("a"."status" = 'published'::"text") AND ("e"."student_id" = "auth"."uid"()) AND ("e"."status" = 'active'::"text")))));



CREATE POLICY "Students can view checked papers for them" ON "public"."checked_papers" FOR SELECT USING ((("student_id" = "auth"."uid"()) OR (("student_id" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."enrollments" "e"
  WHERE (("e"."classroom_id" = "checked_papers"."classroom_id") AND ("e"."student_id" = "auth"."uid"()) AND ("e"."status" = 'active'::"text")))))));



CREATE POLICY "Students can view classroom session series" ON "public"."session_series" FOR SELECT USING ((("scope_type" = 'classroom'::"text") AND ("classroom_id" IS NOT NULL) AND "public"."is_enrolled_in_classroom"("auth"."uid"(), "classroom_id")));



CREATE POLICY "Students can view classroom sessions" ON "public"."sessions" FOR SELECT USING ((("scope_type" = 'classroom'::"text") AND ("classroom_id" IS NOT NULL) AND "public"."is_enrolled_in_classroom"("auth"."uid"(), "classroom_id")));



CREATE POLICY "Students can view documents attached to assignments" ON "public"."documents" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."assignment_attachments" "aa"
     JOIN "public"."assignments" "a" ON (("a"."id" = "aa"."assignment_id")))
     JOIN "public"."enrollments" "e" ON (("e"."classroom_id" = "a"."classroom_id")))
  WHERE (("aa"."document_id" = "documents"."id") AND ("a"."status" = 'published'::"text") AND ("e"."student_id" = "auth"."uid"()) AND ("e"."status" = 'active'::"text")))));



CREATE POLICY "Students can view enrolled classrooms" ON "public"."classrooms" FOR SELECT USING ("public"."is_enrolled_in_classroom"("auth"."uid"(), "id"));



CREATE POLICY "Students can view own one to one session series" ON "public"."session_series" FOR SELECT USING ((("scope_type" = 'one_to_one'::"text") AND ("student_id" IS NOT NULL) AND "public"."can_view_student_session"("student_id", "tutor_id", "workspace_id")));



CREATE POLICY "Students can view own one to one sessions" ON "public"."sessions" FOR SELECT USING ((("scope_type" = 'one_to_one'::"text") AND ("student_id" IS NOT NULL) AND "public"."can_view_student_session"("student_id", "tutor_id", "workspace_id")));



CREATE POLICY "Students can view published assignments" ON "public"."assignments" FOR SELECT USING ((("status" = 'published'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."enrollments"
  WHERE (("enrollments"."classroom_id" = "assignments"."classroom_id") AND ("enrollments"."student_id" = "auth"."uid"()) AND ("enrollments"."status" = 'active'::"text"))))));



CREATE POLICY "Students can view quiz questions" ON "public"."quiz_questions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."quizzes" "q"
     JOIN "public"."enrollments" "e" ON (("e"."classroom_id" = "q"."classroom_id")))
  WHERE (("q"."id" = "quiz_questions"."quiz_id") AND ("q"."status" = ANY (ARRAY['scheduled'::"text", 'active'::"text"])) AND ("e"."student_id" = "auth"."uid"()) AND ("e"."status" = 'active'::"text")))));



CREATE POLICY "Students can view quizzes in enrolled classrooms" ON "public"."quizzes" FOR SELECT USING ((("status" = ANY (ARRAY['scheduled'::"text", 'active'::"text", 'closed'::"text"])) AND (EXISTS ( SELECT 1
   FROM "public"."enrollments"
  WHERE (("enrollments"."classroom_id" = "quizzes"."classroom_id") AND ("enrollments"."student_id" = "auth"."uid"()) AND ("enrollments"."status" = 'active'::"text"))))));



CREATE POLICY "Students can view shared documents" ON "public"."document_classroom_shares" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."enrollments"
  WHERE (("enrollments"."classroom_id" = "document_classroom_shares"."classroom_id") AND ("enrollments"."student_id" = "auth"."uid"()) AND ("enrollments"."status" = 'active'::"text")))));



CREATE POLICY "Students can view shared documents" ON "public"."documents" FOR SELECT USING ("public"."is_document_shared_with_student"("id", "auth"."uid"()));



CREATE POLICY "Students can view their own enrollments" ON "public"."enrollments" FOR SELECT USING (("student_id" = "auth"."uid"()));



CREATE POLICY "Students can view their own quiz attempts" ON "public"."quiz_attempts" FOR SELECT USING (("student_id" = "auth"."uid"()));



CREATE POLICY "Students can view their own submissions" ON "public"."submissions" FOR SELECT USING (("student_id" = "auth"."uid"()));



CREATE POLICY "System can update AI usage" ON "public"."user_ai_usage" USING (true) WITH CHECK (true);



CREATE POLICY "Teachers can add attachments to their assignments" ON "public"."assignment_attachments" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."assignments"
  WHERE (("assignments"."id" = "assignment_attachments"."assignment_id") AND ("assignments"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "Teachers can create AI feedback" ON "public"."ai_feedback" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM ("public"."submissions" "s"
     JOIN "public"."assignments" "a" ON (("a"."id" = "s"."assignment_id")))
  WHERE (("s"."id" = "ai_feedback"."submission_id") AND ("a"."teacher_id" = "auth"."uid"()))))));



CREATE POLICY "Teachers can create assignments" ON "public"."assignments" FOR INSERT WITH CHECK (("teacher_id" = "auth"."uid"()));



CREATE POLICY "Teachers can create quiz questions" ON "public"."quiz_questions" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."quizzes"
  WHERE (("quizzes"."id" = "quiz_questions"."quiz_id") AND ("quizzes"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "Teachers can create quizzes" ON "public"."quizzes" FOR INSERT WITH CHECK (("teacher_id" = "auth"."uid"()));



CREATE POLICY "Teachers can delete own checker presets" ON "public"."checker_presets" FOR DELETE USING (("auth"."uid"() = "teacher_id"));



CREATE POLICY "Teachers can delete own planner events" ON "public"."planner_events" FOR DELETE USING (("teacher_id" = "auth"."uid"()));



CREATE POLICY "Teachers can delete own source documents" ON "public"."source_documents" FOR DELETE USING (("auth"."uid"() = "teacher_id"));



CREATE POLICY "Teachers can delete quiz questions" ON "public"."quiz_questions" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."quizzes"
  WHERE (("quizzes"."id" = "quiz_questions"."quiz_id") AND ("quizzes"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "Teachers can delete their own assignments" ON "public"."assignments" FOR DELETE USING (("teacher_id" = "auth"."uid"()));



CREATE POLICY "Teachers can delete their own classrooms" ON "public"."classrooms" FOR DELETE USING (("teacher_id" = "auth"."uid"()));



CREATE POLICY "Teachers can delete their own quizzes" ON "public"."quizzes" FOR DELETE USING (("teacher_id" = "auth"."uid"()));



CREATE POLICY "Teachers can grade quiz attempts" ON "public"."quiz_attempts" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."quizzes"
  WHERE (("quizzes"."id" = "quiz_attempts"."quiz_id") AND ("quizzes"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "Teachers can grade submissions" ON "public"."submissions" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."assignments"
  WHERE (("assignments"."id" = "submissions"."assignment_id") AND ("assignments"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "Teachers can insert own checker presets" ON "public"."checker_presets" FOR INSERT WITH CHECK (("auth"."uid"() = "teacher_id"));



CREATE POLICY "Teachers can insert own planner events" ON "public"."planner_events" FOR INSERT WITH CHECK (("teacher_id" = "auth"."uid"()));



CREATE POLICY "Teachers can insert own source documents" ON "public"."source_documents" FOR INSERT WITH CHECK (("auth"."uid"() = "teacher_id"));



CREATE POLICY "Teachers can manage own checked papers" ON "public"."checked_papers" USING (("auth"."uid"() = "teacher_id")) WITH CHECK (("auth"."uid"() = "teacher_id"));



CREATE POLICY "Teachers can remove attachments from their assignments" ON "public"."assignment_attachments" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."assignments"
  WHERE (("assignments"."id" = "assignment_attachments"."assignment_id") AND ("assignments"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "Teachers can share their documents" ON "public"."document_classroom_shares" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."documents"
  WHERE (("documents"."id" = "document_classroom_shares"."document_id") AND ("documents"."user_id" = "auth"."uid"())))));



CREATE POLICY "Teachers can unshare their documents" ON "public"."document_classroom_shares" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."documents"
  WHERE (("documents"."id" = "document_classroom_shares"."document_id") AND ("documents"."user_id" = "auth"."uid"())))));



CREATE POLICY "Teachers can update AI feedback" ON "public"."ai_feedback" FOR UPDATE USING ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM ("public"."submissions" "s"
     JOIN "public"."assignments" "a" ON (("a"."id" = "s"."assignment_id")))
  WHERE (("s"."id" = "ai_feedback"."submission_id") AND ("a"."teacher_id" = "auth"."uid"()))))));



CREATE POLICY "Teachers can update enrollments in their classrooms" ON "public"."enrollments" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."classrooms"
  WHERE (("classrooms"."id" = "enrollments"."classroom_id") AND ("classrooms"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "Teachers can update own checker presets" ON "public"."checker_presets" FOR UPDATE USING (("auth"."uid"() = "teacher_id"));



CREATE POLICY "Teachers can update own planner events" ON "public"."planner_events" FOR UPDATE USING (("teacher_id" = "auth"."uid"()));



CREATE POLICY "Teachers can update own source documents" ON "public"."source_documents" FOR UPDATE USING (("auth"."uid"() = "teacher_id"));



CREATE POLICY "Teachers can update quiz questions" ON "public"."quiz_questions" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."quizzes"
  WHERE (("quizzes"."id" = "quiz_questions"."quiz_id") AND ("quizzes"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "Teachers can update their own assignments" ON "public"."assignments" FOR UPDATE USING (("teacher_id" = "auth"."uid"())) WITH CHECK (("teacher_id" = "auth"."uid"()));



CREATE POLICY "Teachers can update their own classrooms" ON "public"."classrooms" FOR UPDATE USING ("public"."is_user_tutor_of_classroom"("auth"."uid"(), "id")) WITH CHECK ("public"."is_user_tutor_of_classroom"("auth"."uid"(), "id"));



CREATE POLICY "Teachers can update their own quizzes" ON "public"."quizzes" FOR UPDATE USING (("teacher_id" = "auth"."uid"())) WITH CHECK (("teacher_id" = "auth"."uid"()));



CREATE POLICY "Teachers can view AI feedback for their submissions" ON "public"."ai_feedback" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."submissions" "s"
     JOIN "public"."assignments" "a" ON (("a"."id" = "s"."assignment_id")))
  WHERE (("s"."id" = "ai_feedback"."submission_id") AND ("a"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "Teachers can view enrollments in their classrooms" ON "public"."enrollments" FOR SELECT USING ("public"."is_classroom_teacher"("auth"."uid"(), "classroom_id"));



CREATE POLICY "Teachers can view own checker presets" ON "public"."checker_presets" FOR SELECT USING (("auth"."uid"() = "teacher_id"));



CREATE POLICY "Teachers can view own planner events" ON "public"."planner_events" FOR SELECT USING (("teacher_id" = "auth"."uid"()));



CREATE POLICY "Teachers can view own source documents" ON "public"."source_documents" FOR SELECT USING (("auth"."uid"() = "teacher_id"));



CREATE POLICY "Teachers can view profiles in their classrooms" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."enrollments" "e"
     JOIN "public"."classrooms" "c" ON (("c"."id" = "e"."classroom_id")))
  WHERE (("e"."student_id" = "profiles"."user_id") AND ("e"."status" = 'active'::"text") AND ("c"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "Teachers can view quiz attempts" ON "public"."quiz_attempts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."quizzes"
  WHERE (("quizzes"."id" = "quiz_attempts"."quiz_id") AND ("quizzes"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "Teachers can view submissions for their assignments" ON "public"."submissions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."assignments"
  WHERE (("assignments"."id" = "submissions"."assignment_id") AND ("assignments"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "Teachers can view their assignment attachments" ON "public"."assignment_attachments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."assignments"
  WHERE (("assignments"."id" = "assignment_attachments"."assignment_id") AND ("assignments"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "Teachers can view their document shares" ON "public"."document_classroom_shares" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."documents"
  WHERE (("documents"."id" = "document_classroom_shares"."document_id") AND ("documents"."user_id" = "auth"."uid"())))));



CREATE POLICY "Teachers can view their own assignments" ON "public"."assignments" FOR SELECT USING (("teacher_id" = "auth"."uid"()));



CREATE POLICY "Teachers can view their own classrooms" ON "public"."classrooms" FOR SELECT USING ("public"."is_user_tutor_of_classroom"("auth"."uid"(), "id"));



CREATE POLICY "Teachers can view their own quizzes" ON "public"."quizzes" FOR SELECT USING (("teacher_id" = "auth"."uid"()));



CREATE POLICY "Teachers can view their quiz questions" ON "public"."quiz_questions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."quizzes"
  WHERE (("quizzes"."id" = "quiz_questions"."quiz_id") AND ("quizzes"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "Tutors can delete own private session notes" ON "public"."session_notes" FOR DELETE USING (("tutor_id" = "auth"."uid"()));



CREATE POLICY "Tutors can delete own session financial mock" ON "public"."session_financial_mock" FOR DELETE USING (("tutor_id" = "auth"."uid"()));



CREATE POLICY "Tutors can delete own session series" ON "public"."session_series" FOR DELETE USING (("tutor_id" = "auth"."uid"()));



CREATE POLICY "Tutors can delete sessions they manage" ON "public"."sessions" FOR DELETE USING (("tutor_id" = "auth"."uid"()));



CREATE POLICY "Tutors can insert own private session notes" ON "public"."session_notes" FOR INSERT WITH CHECK ((("tutor_id" = "auth"."uid"()) AND ("created_by_user_id" = "auth"."uid"()) AND ("updated_by_user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."sessions" "s"
  WHERE (("s"."id" = "session_notes"."session_id") AND ("s"."workspace_id" = "session_notes"."workspace_id") AND ("s"."tutor_id" = "auth"."uid"()))))));



CREATE POLICY "Tutors can insert own session financial mock" ON "public"."session_financial_mock" FOR INSERT WITH CHECK ((("tutor_id" = "auth"."uid"()) AND ("created_by_user_id" = "auth"."uid"()) AND ("updated_by_user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."sessions" "s"
  WHERE (("s"."id" = "session_financial_mock"."session_id") AND ("s"."workspace_id" = "session_financial_mock"."workspace_id") AND ("s"."tutor_id" = "auth"."uid"()))))));



CREATE POLICY "Tutors can insert own session series" ON "public"."session_series" FOR INSERT WITH CHECK ((("tutor_id" = "auth"."uid"()) AND ((("scope_type" = 'classroom'::"text") AND ("classroom_id" IS NOT NULL) AND "public"."is_classroom_in_workspace"("classroom_id", "workspace_id") AND "public"."is_user_tutor_of_classroom"("auth"."uid"(), "classroom_id")) OR (("scope_type" = 'one_to_one'::"text") AND ("student_id" IS NOT NULL) AND "public"."can_manage_student_assignment"("student_id", "auth"."uid"(), "workspace_id")))));



CREATE POLICY "Tutors can insert sessions they manage" ON "public"."sessions" FOR INSERT WITH CHECK ((("tutor_id" = "auth"."uid"()) AND ((("scope_type" = 'classroom'::"text") AND ("classroom_id" IS NOT NULL) AND "public"."is_classroom_in_workspace"("classroom_id", "workspace_id") AND "public"."is_user_tutor_of_classroom"("auth"."uid"(), "classroom_id")) OR (("scope_type" = 'one_to_one'::"text") AND ("student_id" IS NOT NULL) AND "public"."can_manage_student_assignment"("student_id", "auth"."uid"(), "workspace_id")))));



CREATE POLICY "Tutors can read and update own tutor_contracts" ON "public"."tutor_contracts" FOR SELECT USING (("tutor_id" = "auth"."uid"()));



CREATE POLICY "Tutors can update own private session notes" ON "public"."session_notes" FOR UPDATE USING (("tutor_id" = "auth"."uid"())) WITH CHECK ((("tutor_id" = "auth"."uid"()) AND ("updated_by_user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."sessions" "s"
  WHERE (("s"."id" = "session_notes"."session_id") AND ("s"."workspace_id" = "session_notes"."workspace_id") AND ("s"."tutor_id" = "auth"."uid"()))))));



CREATE POLICY "Tutors can update own session financial mock" ON "public"."session_financial_mock" FOR UPDATE USING (("tutor_id" = "auth"."uid"())) WITH CHECK ((("tutor_id" = "auth"."uid"()) AND ("updated_by_user_id" = "auth"."uid"())));



CREATE POLICY "Tutors can update own session series" ON "public"."session_series" FOR UPDATE USING (("tutor_id" = "auth"."uid"())) WITH CHECK (("tutor_id" = "auth"."uid"()));



CREATE POLICY "Tutors can update own tutor_contracts for sign or request" ON "public"."tutor_contracts" FOR UPDATE USING (("tutor_id" = "auth"."uid"()));



CREATE POLICY "Tutors can update sessions they manage" ON "public"."sessions" FOR UPDATE USING (("tutor_id" = "auth"."uid"())) WITH CHECK (("tutor_id" = "auth"."uid"()));



CREATE POLICY "Tutors can view classroom_tutors for their classrooms" ON "public"."classroom_tutors" FOR SELECT USING ("public"."is_user_tutor_of_classroom"("auth"."uid"(), "classroom_id"));



CREATE POLICY "Tutors can view own private session notes" ON "public"."session_notes" FOR SELECT USING (("tutor_id" = "auth"."uid"()));



CREATE POLICY "Tutors can view own session financial mock" ON "public"."session_financial_mock" FOR SELECT USING (("tutor_id" = "auth"."uid"()));



CREATE POLICY "Tutors can view own session series" ON "public"."session_series" FOR SELECT USING ((("tutor_id" = "auth"."uid"()) OR (("scope_type" = 'classroom'::"text") AND ("classroom_id" IS NOT NULL) AND "public"."is_user_tutor_of_classroom"("auth"."uid"(), "classroom_id"))));



CREATE POLICY "Tutors can view sessions they manage" ON "public"."sessions" FOR SELECT USING ((("tutor_id" = "auth"."uid"()) OR (("scope_type" = 'classroom'::"text") AND ("classroom_id" IS NOT NULL) AND "public"."is_user_tutor_of_classroom"("auth"."uid"(), "classroom_id"))));



CREATE POLICY "Users can create document tags" ON "public"."document_tags" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."documents"
  WHERE (("documents"."id" = "document_tags"."document_id") AND ("documents"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can create their own AI interactions" ON "public"."ai_interactions" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can create their own documents" ON "public"."documents" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can create their own folders" ON "public"."folders" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can create their own generated content" ON "public"."ai_generated_content" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can create their own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can create their own role during signup" ON "public"."user_roles" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can create their own tags" ON "public"."tags" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete document tags" ON "public"."document_tags" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."documents"
  WHERE (("documents"."id" = "document_tags"."document_id") AND ("documents"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete own Google calendar connection" ON "public"."google_calendar_connections" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete their own documents" ON "public"."documents" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete their own folders" ON "public"."folders" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete their own generated content" ON "public"."ai_generated_content" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete their own tags" ON "public"."tags" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert own Google calendar connection" ON "public"."google_calendar_connections" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own Google calendar connection" ON "public"."google_calendar_connections" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own documents" ON "public"."documents" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own folders" ON "public"."folders" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own generated content" ON "public"."ai_generated_content" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own tags" ON "public"."tags" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own Google calendar connection" ON "public"."google_calendar_connections" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own credit allocations" ON "public"."user_credit_allocations" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own storage allocations" ON "public"."user_storage_allocations" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own subscription" ON "public"."user_subscriptions" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their document tags" ON "public"."document_tags" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."documents"
  WHERE (("documents"."id" = "document_tags"."document_id") AND ("documents"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their own AI interactions" ON "public"."ai_interactions" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own AI usage" ON "public"."user_ai_usage" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own documents" ON "public"."documents" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own folders" ON "public"."folders" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own generated content" ON "public"."ai_generated_content" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own role" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own tags" ON "public"."tags" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view workspace members of their workspace" ON "public"."workspace_members" FOR SELECT USING (("public"."is_workspace_owner"("workspace_id") OR ("user_id" = "auth"."uid"())));



CREATE POLICY "Workspace members can view subscription" ON "public"."workspace_subscriptions" FOR SELECT USING (("public"."is_workspace_owner"("workspace_id") OR "public"."is_workspace_member"("workspace_id")));



CREATE POLICY "Workspace members can view workspace" ON "public"."workspaces" FOR SELECT USING ((("owner_id" = "auth"."uid"()) OR "public"."is_workspace_member"("id")));



CREATE POLICY "Workspace members can view workspace credit pool" ON "public"."workspace_credit_pools" FOR SELECT USING (("public"."is_workspace_member"("workspace_id") OR "public"."is_workspace_owner"("workspace_id")));



CREATE POLICY "Workspace owners and members can view credit audit" ON "public"."credit_assignments_audit" FOR SELECT USING (("public"."is_workspace_owner"("workspace_id") OR "public"."is_workspace_member"("workspace_id")));



CREATE POLICY "Workspace owners can view profiles of assigned students" ON "public"."profiles" FOR SELECT TO "authenticated" USING ("public"."owner_can_view_student_profile"("user_id"));



CREATE POLICY "Workspace owners can view profiles of workspace members" ON "public"."profiles" FOR SELECT TO "authenticated" USING ("public"."owner_can_view_member_profile"("user_id"));



CREATE POLICY "Workspace owners can view workspace storage allocations" ON "public"."user_storage_allocations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."workspaces" "w"
  WHERE (("w"."id" = "user_storage_allocations"."workspace_id") AND ("w"."owner_id" = "auth"."uid"())))));



ALTER TABLE "public"."ai_feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_generated_content" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_interactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."assignment_attachments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."checked_papers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."checker_presets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."classroom_tutors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."classrooms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credit_assignments_audit" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."document_classroom_shares" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."document_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."enrollments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."folders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."google_calendar_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."planner_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quiz_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quiz_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quizzes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_financial_mock" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_series" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."source_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tutor_contracts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tutor_student_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_ai_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_credit_allocations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_storage_allocations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workspace_credit_pools" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workspace_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workspace_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workspaces" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";































































































































































GRANT ALL ON FUNCTION "public"."assign_credits_to_member"("_workspace_id" "uuid", "_member_user_id" "uuid", "_credits" integer, "_caller_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."assign_credits_to_member"("_workspace_id" "uuid", "_member_user_id" "uuid", "_credits" integer, "_caller_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_credits_to_member"("_workspace_id" "uuid", "_member_user_id" "uuid", "_credits" integer, "_caller_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_storage_to_member"("_workspace_id" "uuid", "_member_user_id" "uuid", "_storage_limit_mb" integer, "_caller_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."assign_storage_to_member"("_workspace_id" "uuid", "_member_user_id" "uuid", "_storage_limit_mb" integer, "_caller_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_storage_to_member"("_workspace_id" "uuid", "_member_user_id" "uuid", "_storage_limit_mb" integer, "_caller_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_quiz_score"("attempt_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_quiz_score"("attempt_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_quiz_score"("attempt_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_attempt_quiz"("_quiz_id" "uuid", "_student_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_attempt_quiz"("_quiz_id" "uuid", "_student_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_attempt_quiz"("_quiz_id" "uuid", "_student_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_make_ai_request"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_make_ai_request"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_make_ai_request"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_manage_student_assignment"("p_student_id" "uuid", "p_tutor_id" "uuid", "p_workspace_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_manage_student_assignment"("p_student_id" "uuid", "p_tutor_id" "uuid", "p_workspace_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_manage_student_assignment"("p_student_id" "uuid", "p_tutor_id" "uuid", "p_workspace_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_view_student_session"("p_student_id" "uuid", "p_tutor_id" "uuid", "p_workspace_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_view_student_session"("p_student_id" "uuid", "p_tutor_id" "uuid", "p_workspace_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_view_student_session"("p_student_id" "uuid", "p_tutor_id" "uuid", "p_workspace_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_and_deduct_credits"("_user_id" "uuid", "_task_type" "text", "_credit_cost" integer, "_interaction_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_and_deduct_credits"("_user_id" "uuid", "_task_type" "text", "_credit_cost" integer, "_interaction_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_and_deduct_credits"("_user_id" "uuid", "_task_type" "text", "_credit_cost" integer, "_interaction_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_join_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_join_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_join_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_classroom_by_join_code"("code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_classroom_by_join_code"("code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_classroom_by_join_code"("code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_credit_context"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_credit_context"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_credit_context"("_user_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."user_ai_usage" TO "anon";
GRANT ALL ON TABLE "public"."user_ai_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."user_ai_usage" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_ai_usage"("_user_id" "uuid", "_month" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_ai_usage"("_user_id" "uuid", "_month" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_ai_usage"("_user_id" "uuid", "_month" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_role"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_role"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_classroom_in_owner_workspace"("p_teacher_id" "uuid", "p_owner_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_classroom_in_owner_workspace"("p_teacher_id" "uuid", "p_owner_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_classroom_in_owner_workspace"("p_teacher_id" "uuid", "p_owner_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_classroom_in_workspace"("p_classroom_id" "uuid", "p_workspace_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_classroom_in_workspace"("p_classroom_id" "uuid", "p_workspace_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_classroom_in_workspace"("p_classroom_id" "uuid", "p_workspace_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_classroom_owned_by_owner"("p_classroom_id" "uuid", "p_owner_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_classroom_owned_by_owner"("p_classroom_id" "uuid", "p_owner_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_classroom_owned_by_owner"("p_classroom_id" "uuid", "p_owner_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_classroom_teacher"("_user_id" "uuid", "_classroom_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_classroom_teacher"("_user_id" "uuid", "_classroom_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_classroom_teacher"("_user_id" "uuid", "_classroom_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_document_shared_with_student"("p_doc_id" "uuid", "p_student_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_document_shared_with_student"("p_doc_id" "uuid", "p_student_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_document_shared_with_student"("p_doc_id" "uuid", "p_student_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_document_user_in_owner_workspace"("p_user_id" "uuid", "p_owner_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_document_user_in_owner_workspace"("p_user_id" "uuid", "p_owner_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_document_user_in_owner_workspace"("p_user_id" "uuid", "p_owner_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_enrolled_in_classroom"("_user_id" "uuid", "_classroom_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_enrolled_in_classroom"("_user_id" "uuid", "_classroom_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_enrolled_in_classroom"("_user_id" "uuid", "_classroom_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_enrollment_classroom_in_owner_workspace"("p_classroom_id" "uuid", "p_owner_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_enrollment_classroom_in_owner_workspace"("p_classroom_id" "uuid", "p_owner_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_enrollment_classroom_in_owner_workspace"("p_classroom_id" "uuid", "p_owner_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_storage_object_attached_to_assignment"("p_file_path" "text", "p_student_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_storage_object_attached_to_assignment"("p_file_path" "text", "p_student_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_storage_object_attached_to_assignment"("p_file_path" "text", "p_student_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_storage_object_shared_with_student"("p_file_path" "text", "p_student_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_storage_object_shared_with_student"("p_file_path" "text", "p_student_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_storage_object_shared_with_student"("p_file_path" "text", "p_student_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_submission_in_owner_workspace"("p_assignment_id" "uuid", "p_owner_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_submission_in_owner_workspace"("p_assignment_id" "uuid", "p_owner_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_submission_in_owner_workspace"("p_assignment_id" "uuid", "p_owner_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_user_tutor_of_classroom"("p_user_id" "uuid", "p_classroom_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_user_tutor_of_classroom"("p_user_id" "uuid", "p_classroom_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_user_tutor_of_classroom"("p_user_id" "uuid", "p_classroom_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_workspace_member"("_workspace_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_workspace_member"("_workspace_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_workspace_member"("_workspace_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_workspace_owner"("_workspace_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_workspace_owner"("_workspace_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_workspace_owner"("_workspace_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."owner_can_insert_classroom"("p_workspace_id" "uuid", "p_teacher_id" "uuid", "p_owner_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."owner_can_insert_classroom"("p_workspace_id" "uuid", "p_teacher_id" "uuid", "p_owner_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."owner_can_insert_classroom"("p_workspace_id" "uuid", "p_teacher_id" "uuid", "p_owner_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."owner_can_view_member_profile"("_member_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."owner_can_view_member_profile"("_member_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."owner_can_view_member_profile"("_member_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."owner_can_view_student_profile"("_student_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."owner_can_view_student_profile"("_student_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."owner_can_view_student_profile"("_student_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."record_ai_interaction"("_user_id" "uuid", "_interaction_type" "text", "_provider" "text", "_model" "text", "_tokens_used" integer, "_cost" numeric, "_success" boolean, "_error_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."record_ai_interaction"("_user_id" "uuid", "_interaction_type" "text", "_provider" "text", "_model" "text", "_tokens_used" integer, "_cost" numeric, "_success" boolean, "_error_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_ai_interaction"("_user_id" "uuid", "_interaction_type" "text", "_provider" "text", "_model" "text", "_tokens_used" integer, "_cost" numeric, "_success" boolean, "_error_message" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_subscription_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_subscription_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_subscription_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_tutor_contracts_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_tutor_contracts_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_tutor_contracts_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_workspaces_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_workspaces_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_workspaces_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."quiz_attempts" TO "anon";
GRANT ALL ON TABLE "public"."quiz_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."quiz_attempts" TO "service_role";



GRANT ALL ON FUNCTION "public"."start_quiz_attempt"("_quiz_id" "uuid", "_student_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."start_quiz_attempt"("_quiz_id" "uuid", "_student_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."start_quiz_attempt"("_quiz_id" "uuid", "_student_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_assigned_credits"("_workspace_id" "uuid", "_member_user_id" "uuid", "_new_limit" integer, "_caller_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_assigned_credits"("_workspace_id" "uuid", "_member_user_id" "uuid", "_new_limit" integer, "_caller_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_assigned_credits"("_workspace_id" "uuid", "_member_user_id" "uuid", "_new_limit" integer, "_caller_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_assigned_storage_limit"("_workspace_id" "uuid", "_member_user_id" "uuid", "_new_limit_mb" integer, "_caller_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_assigned_storage_limit"("_workspace_id" "uuid", "_member_user_id" "uuid", "_new_limit_mb" integer, "_caller_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_assigned_storage_limit"("_workspace_id" "uuid", "_member_user_id" "uuid", "_new_limit_mb" integer, "_caller_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_user_credit_allocation_subscription"("_user_id" "uuid", "_period" "date", "_credits_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_user_credit_allocation_subscription"("_user_id" "uuid", "_period" "date", "_credits_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_user_credit_allocation_subscription"("_user_id" "uuid", "_period" "date", "_credits_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_workspace_credit_pool"("_workspace_id" "uuid", "_period" "date", "_credits_allocated" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_workspace_credit_pool"("_workspace_id" "uuid", "_period" "date", "_credits_allocated" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_workspace_credit_pool"("_workspace_id" "uuid", "_period" "date", "_credits_allocated" integer) TO "service_role";


















GRANT ALL ON TABLE "public"."ai_feedback" TO "anon";
GRANT ALL ON TABLE "public"."ai_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."ai_generated_content" TO "anon";
GRANT ALL ON TABLE "public"."ai_generated_content" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_generated_content" TO "service_role";



GRANT ALL ON TABLE "public"."ai_interactions" TO "anon";
GRANT ALL ON TABLE "public"."ai_interactions" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_interactions" TO "service_role";



GRANT ALL ON TABLE "public"."assignment_attachments" TO "anon";
GRANT ALL ON TABLE "public"."assignment_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."assignment_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."assignments" TO "anon";
GRANT ALL ON TABLE "public"."assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."assignments" TO "service_role";



GRANT ALL ON TABLE "public"."checked_papers" TO "anon";
GRANT ALL ON TABLE "public"."checked_papers" TO "authenticated";
GRANT ALL ON TABLE "public"."checked_papers" TO "service_role";



GRANT ALL ON TABLE "public"."checker_presets" TO "anon";
GRANT ALL ON TABLE "public"."checker_presets" TO "authenticated";
GRANT ALL ON TABLE "public"."checker_presets" TO "service_role";



GRANT ALL ON TABLE "public"."classroom_tutors" TO "anon";
GRANT ALL ON TABLE "public"."classroom_tutors" TO "authenticated";
GRANT ALL ON TABLE "public"."classroom_tutors" TO "service_role";



GRANT ALL ON TABLE "public"."classrooms" TO "anon";
GRANT ALL ON TABLE "public"."classrooms" TO "authenticated";
GRANT ALL ON TABLE "public"."classrooms" TO "service_role";



GRANT ALL ON TABLE "public"."credit_assignments_audit" TO "anon";
GRANT ALL ON TABLE "public"."credit_assignments_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_assignments_audit" TO "service_role";



GRANT ALL ON TABLE "public"."document_classroom_shares" TO "anon";
GRANT ALL ON TABLE "public"."document_classroom_shares" TO "authenticated";
GRANT ALL ON TABLE "public"."document_classroom_shares" TO "service_role";



GRANT ALL ON TABLE "public"."document_tags" TO "anon";
GRANT ALL ON TABLE "public"."document_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."document_tags" TO "service_role";



GRANT ALL ON TABLE "public"."documents" TO "anon";
GRANT ALL ON TABLE "public"."documents" TO "authenticated";
GRANT ALL ON TABLE "public"."documents" TO "service_role";



GRANT ALL ON TABLE "public"."enrollments" TO "anon";
GRANT ALL ON TABLE "public"."enrollments" TO "authenticated";
GRANT ALL ON TABLE "public"."enrollments" TO "service_role";



GRANT ALL ON TABLE "public"."folders" TO "anon";
GRANT ALL ON TABLE "public"."folders" TO "authenticated";
GRANT ALL ON TABLE "public"."folders" TO "service_role";



GRANT ALL ON TABLE "public"."google_calendar_connections" TO "anon";
GRANT ALL ON TABLE "public"."google_calendar_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."google_calendar_connections" TO "service_role";



GRANT ALL ON TABLE "public"."planner_events" TO "anon";
GRANT ALL ON TABLE "public"."planner_events" TO "authenticated";
GRANT ALL ON TABLE "public"."planner_events" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."quiz_questions" TO "anon";
GRANT ALL ON TABLE "public"."quiz_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."quiz_questions" TO "service_role";



GRANT ALL ON TABLE "public"."quizzes" TO "anon";
GRANT ALL ON TABLE "public"."quizzes" TO "authenticated";
GRANT ALL ON TABLE "public"."quizzes" TO "service_role";



GRANT ALL ON TABLE "public"."session_financial_mock" TO "anon";
GRANT ALL ON TABLE "public"."session_financial_mock" TO "authenticated";
GRANT ALL ON TABLE "public"."session_financial_mock" TO "service_role";



GRANT ALL ON TABLE "public"."session_notes" TO "anon";
GRANT ALL ON TABLE "public"."session_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."session_notes" TO "service_role";



GRANT ALL ON TABLE "public"."session_series" TO "anon";
GRANT ALL ON TABLE "public"."session_series" TO "authenticated";
GRANT ALL ON TABLE "public"."session_series" TO "service_role";



GRANT ALL ON TABLE "public"."sessions" TO "anon";
GRANT ALL ON TABLE "public"."sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."sessions" TO "service_role";



GRANT ALL ON TABLE "public"."source_documents" TO "anon";
GRANT ALL ON TABLE "public"."source_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."source_documents" TO "service_role";



GRANT ALL ON TABLE "public"."submissions" TO "anon";
GRANT ALL ON TABLE "public"."submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."submissions" TO "service_role";



GRANT ALL ON TABLE "public"."tags" TO "anon";
GRANT ALL ON TABLE "public"."tags" TO "authenticated";
GRANT ALL ON TABLE "public"."tags" TO "service_role";



GRANT ALL ON TABLE "public"."tutor_contracts" TO "anon";
GRANT ALL ON TABLE "public"."tutor_contracts" TO "authenticated";
GRANT ALL ON TABLE "public"."tutor_contracts" TO "service_role";



GRANT ALL ON TABLE "public"."tutor_student_assignments" TO "anon";
GRANT ALL ON TABLE "public"."tutor_student_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."tutor_student_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."user_credit_allocations" TO "anon";
GRANT ALL ON TABLE "public"."user_credit_allocations" TO "authenticated";
GRANT ALL ON TABLE "public"."user_credit_allocations" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."user_storage_allocations" TO "anon";
GRANT ALL ON TABLE "public"."user_storage_allocations" TO "authenticated";
GRANT ALL ON TABLE "public"."user_storage_allocations" TO "service_role";



GRANT ALL ON TABLE "public"."user_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."user_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."workspace_credit_pools" TO "anon";
GRANT ALL ON TABLE "public"."workspace_credit_pools" TO "authenticated";
GRANT ALL ON TABLE "public"."workspace_credit_pools" TO "service_role";



GRANT ALL ON TABLE "public"."workspace_members" TO "anon";
GRANT ALL ON TABLE "public"."workspace_members" TO "authenticated";
GRANT ALL ON TABLE "public"."workspace_members" TO "service_role";



GRANT ALL ON TABLE "public"."workspace_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."workspace_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."workspace_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."workspaces" TO "anon";
GRANT ALL ON TABLE "public"."workspaces" TO "authenticated";
GRANT ALL ON TABLE "public"."workspaces" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
































--
-- Dumped schema changes for auth and storage
--

CREATE OR REPLACE TRIGGER "on_auth_user_created" AFTER INSERT ON "auth"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();



CREATE POLICY "Avatar images are publicly accessible" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'avatars'::"text"));



CREATE POLICY "Contract PDFs readable by workspace owner or tutor" ON "storage"."objects" FOR SELECT USING ((("bucket_id" = 'contracts'::"text") AND ((("storage"."foldername"("name"))[1] IN ( SELECT ("w"."id")::"text" AS "id"
   FROM "public"."workspaces" "w"
  WHERE ("w"."owner_id" = "auth"."uid"()))) OR ("name" ~~ (('%/'::"text" || ("auth"."uid"())::"text") || '.pdf'::"text")))));



CREATE POLICY "Students can download assignment attachment documents" ON "storage"."objects" FOR SELECT USING ((("bucket_id" = 'documents'::"text") AND "public"."is_storage_object_attached_to_assignment"("name", "auth"."uid"())));



CREATE POLICY "Students can download shared documents" ON "storage"."objects" FOR SELECT USING ((("bucket_id" = 'documents'::"text") AND "public"."is_storage_object_shared_with_student"("name", "auth"."uid"())));



CREATE POLICY "Students can upload submissions" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'submissions'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));



CREATE POLICY "Students can view their own file submissions" ON "storage"."objects" FOR SELECT USING ((("bucket_id" = 'submissions'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));



CREATE POLICY "Teachers and students can read checked papers" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'checked-papers'::"text"));



CREATE POLICY "Teachers can update own checked papers" ON "storage"."objects" FOR UPDATE USING ((("bucket_id" = 'checked-papers'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));



CREATE POLICY "Teachers can upload checked papers" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'checked-papers'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));



CREATE POLICY "Teachers can view student file submissions" ON "storage"."objects" FOR SELECT USING ((("bucket_id" = 'submissions'::"text") AND (EXISTS ( SELECT 1
   FROM ("public"."submissions" "s"
     JOIN "public"."assignments" "a" ON (("a"."id" = "s"."assignment_id")))
  WHERE (("s"."file_path" = "objects"."name") AND ("a"."teacher_id" = "auth"."uid"()))))));



CREATE POLICY "Users can delete their own avatars" ON "storage"."objects" FOR DELETE USING ((("bucket_id" = 'avatars'::"text") AND ("auth"."uid"() = "owner")));



CREATE POLICY "Users can delete their own documents" ON "storage"."objects" FOR DELETE USING ((("bucket_id" = 'documents'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));



CREATE POLICY "Users can update their own avatars" ON "storage"."objects" FOR UPDATE USING ((("bucket_id" = 'avatars'::"text") AND ("auth"."uid"() = "owner")));



CREATE POLICY "Users can update their own documents" ON "storage"."objects" FOR UPDATE USING ((("bucket_id" = 'documents'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));



CREATE POLICY "Users can upload their own avatars" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'avatars'::"text") AND ("auth"."uid"() = "owner")));



CREATE POLICY "Users can upload their own documents" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'documents'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));



CREATE POLICY "Users can view their own documents" ON "storage"."objects" FOR SELECT USING ((("bucket_id" = 'documents'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));



CREATE POLICY "Workspace logos are publicly accessible" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'workspace-logos'::"text"));



CREATE POLICY "Workspace owners can delete logos" ON "storage"."objects" FOR DELETE USING ((("bucket_id" = 'workspace-logos'::"text") AND (("storage"."foldername"("name"))[1] IN ( SELECT ("workspaces"."id")::"text" AS "id"
   FROM "public"."workspaces"
  WHERE ("workspaces"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Workspace owners can update logos" ON "storage"."objects" FOR UPDATE USING ((("bucket_id" = 'workspace-logos'::"text") AND (("storage"."foldername"("name"))[1] IN ( SELECT ("workspaces"."id")::"text" AS "id"
   FROM "public"."workspaces"
  WHERE ("workspaces"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Workspace owners can upload logos" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'workspace-logos'::"text") AND (("storage"."foldername"("name"))[1] IN ( SELECT ("workspaces"."id")::"text" AS "id"
   FROM "public"."workspaces"
  WHERE ("workspaces"."owner_id" = "auth"."uid"())))));



