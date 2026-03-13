-- Remove description from classrooms table and from get_classroom_by_join_code return type.

-- Drop the function first (return type is changing, so CREATE OR REPLACE is not allowed)
DROP FUNCTION IF EXISTS "public"."get_classroom_by_join_code"("code" "text");

-- Recreate function without description in return type
CREATE FUNCTION "public"."get_classroom_by_join_code"("code" "text")
  RETURNS TABLE("id" "uuid", "name" "text", "subject" "text", "teacher_name" "text")
  LANGUAGE "plpgsql" SECURITY DEFINER
  SET "search_path" TO 'public'
  AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.subject,
    COALESCE(p.display_name, 'Teacher')::text AS teacher_name
  FROM public.classrooms c
  LEFT JOIN public.profiles p ON p.user_id = c.teacher_id
  WHERE c.join_code = UPPER(code)
  AND c.is_archived = false;
END;
$$;

ALTER FUNCTION "public"."get_classroom_by_join_code"("code" "text") OWNER TO "postgres";

-- Restore grants (dropping the function removes them)
GRANT ALL ON FUNCTION "public"."get_classroom_by_join_code"("code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_classroom_by_join_code"("code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_classroom_by_join_code"("code" "text") TO "service_role";

-- Drop description column from classrooms
ALTER TABLE "public"."classrooms" DROP COLUMN IF EXISTS "description";
