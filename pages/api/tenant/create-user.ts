import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { passwordSchema } from "@/lib/validation";
import type { AppRole } from "@/types/auth";

type CreateUserRole = "tutor" | "student";

const bodySchema = {
  email: (v: unknown) => typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
  password: (v: unknown) => typeof v === "string" && passwordSchema.safeParse(v).success,
  firstName: (v: unknown) => typeof v === "string" && v.trim().length > 0,
  lastName: (v: unknown) => typeof v === "string" && v.trim().length > 0,
  role: (v: unknown): v is CreateUserRole => v === "tutor" || v === "student",
  tutorId: (v: unknown) => v === undefined || (typeof v === "string" && v.length > 0),
  initialCredits: (v: unknown) => v === undefined || (typeof v === "number" && Number.isInteger(v) && v >= 0) || (typeof v === "string" && /^\d+$/.test(v)),
  initialStorageMb: (v: unknown) => v === undefined || (typeof v === "number" && Number.isInteger(v) && v >= 0) || (typeof v === "string" && /^\d+$/.test(v)),
  subjects: (v: unknown) =>
    v === undefined ||
    (Array.isArray(v) && v.every((s) => typeof s === "string")) ||
    (typeof v === "string" && (v === "" || v.trim().length >= 0)),
};

/**
 * Tenant-style account creation: only workspace owners can create tutors and students.
 * Email is unique system-wide (enforced by Supabase Auth).
 * Creates auth user + profile + user_roles + workspace_members (tutor) or workspace_students (student).
 * Optional classroomIds: add new student to those classrooms (enrollments) after adding to workspace.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { user: caller, error: authError } = await getAuthUser(req, res);
  if (authError || !caller) {
    return res.status(401).json({ error: authError?.message ?? "Unauthorized" });
  }

  if (!supabaseAdmin) {
    return res.status(503).json({ error: "Server configuration error" });
  }

  const body = (req.body || {}) as {
    email?: unknown;
    password?: unknown;
    firstName?: unknown;
    lastName?: unknown;
    role?: unknown;
    tutorId?: unknown;
    classroomIds?: unknown;
    initialCredits?: unknown;
    initialStorageMb?: unknown;
    subjects?: unknown;
  };

  const classroomIdsRaw = body.classroomIds;
  const classroomIds: string[] = Array.isArray(classroomIdsRaw)
    ? (classroomIdsRaw as unknown[]).filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];

  if (
    !bodySchema.email(body.email) ||
    !bodySchema.password(body.password) ||
    !bodySchema.firstName(body.firstName) ||
    !bodySchema.lastName(body.lastName) ||
    !bodySchema.role(body.role) ||
    !bodySchema.tutorId(body.tutorId)
  ) {
    return res.status(400).json({
      error:
        "Invalid body: email, password, firstName, lastName, role (tutor|student) required; tutorId optional (only for legacy).",
    });
  }

  const email = (body.email as string).trim().toLowerCase();
  const password = body.password as string;
  const displayName = `${(body.firstName as string).trim()} ${(body.lastName as string).trim()}`;
  const role: CreateUserRole = body.role;
  const tutorId = body.tutorId as string | undefined;
  const initialCredits = bodySchema.initialCredits(body.initialCredits)
    ? (typeof body.initialCredits === "number" ? body.initialCredits : parseInt(String(body.initialCredits), 10))
    : 0;
  const initialStorageMb = bodySchema.initialStorageMb(body.initialStorageMb)
    ? (typeof body.initialStorageMb === "number" ? body.initialStorageMb : parseInt(String(body.initialStorageMb), 10))
    : 0;
  const subjectsRaw = body.subjects;
  const subjects: string[] = Array.isArray(subjectsRaw)
    ? (subjectsRaw as string[]).filter((s) => typeof s === "string")
    : typeof subjectsRaw === "string"
      ? subjectsRaw
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean)
      : [];

  // Resolve caller role and workspace
  const { data: roleRow } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", caller.id)
    .maybeSingle();

  const callerRole = roleRow?.role as AppRole | undefined;

  if (callerRole !== "admin") {
    return res.status(403).json({ error: "Only workspace owners can create tutors and students" });
  }

  const { data: workspace, error: wsErr } = await supabaseAdmin
    .from("workspaces")
    .select("id, settings")
    .eq("owner_id", caller.id)
    .limit(1)
    .maybeSingle();
  if (wsErr || !workspace) {
    return res.status(403).json({ error: "No workspace found for owner" });
  }
  const workspaceId = workspace.id;
  const workspaceSettings = (workspace.settings ?? {}) as { default_currency?: string };
  const defaultCurrency =
    typeof workspaceSettings.default_currency === "string" && workspaceSettings.default_currency.trim()
      ? workspaceSettings.default_currency.trim()
      : "GBP";

  const appRole: AppRole = role === "tutor" ? "teacher" : "student";
  // Create auth user; trigger will create user_roles from user_metadata.role
  const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName, role: appRole },
  });

  if (createError) {
    const msg = createError.message || "";
    if (msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("already exists") || createError.status === 422) {
      return res.status(409).json({ error: "This email is already registered. Use a different email or ask the user to sign in." });
    }
    console.error("[tenant/create-user] createUser error:", createError);
    return res.status(400).json({ error: msg || "Failed to create user" });
  }

  const newUserId = authData.user?.id;
  if (!newUserId) {
    return res.status(500).json({ error: "User created but id missing" });
  }

  const accountType = role === "tutor" ? "tutor" : "student";
  const now = new Date().toISOString();
  // Invited users must change password on first login; leave password_changed_at null
  const { error: profileErr } = await supabaseAdmin
    .from("profiles")
    .update({
      display_name: displayName,
      email,
      account_type: accountType,
      onboarding_completed_at: now,
      password_changed_at: null,
      updated_at: now,
    })
    .eq("user_id", newUserId);
  if (profileErr) {
    const upserted = await supabaseAdmin.from("profiles").upsert(
      {
        user_id: newUserId,
        display_name: displayName,
        email,
        account_type: accountType,
        onboarding_completed_at: now,
        password_changed_at: null,
        updated_at: now,
      },
      { onConflict: "user_id" }
    );
    if (upserted.error) {
      console.error("[tenant/create-user] profiles upsert:", upserted.error);
      return res.status(500).json({ error: "Failed to set profile" });
    }
  }

  if (role === "tutor") {
    const { error: memberErr } = await supabaseAdmin.from("workspace_members").insert({
      workspace_id: workspaceId,
      user_id: newUserId,
      role: "tutor",
    });
    if (memberErr) {
      console.error("[tenant/create-user] workspace_members insert:", memberErr);
      return res.status(500).json({ error: "Failed to add tutor to workspace" });
    }
    const { error: contractErr } = await supabaseAdmin.from("tutor_contracts").insert({
      workspace_id: workspaceId,
      tutor_id: newUserId,
      contract_status: "draft",
      pay_type: "hourly",
      rate_amount: 0,
      rate_currency: defaultCurrency,
      subjects: subjects.length ? subjects : [],
    });
    if (contractErr) {
      console.error("[tenant/create-user] tutor_contracts insert:", contractErr);
      return res.status(500).json({ error: "Failed to create tutor contract record" });
    }
  } else {
    const { error: wsStudentErr } = await supabaseAdmin.from("workspace_students").insert({
      workspace_id: workspaceId,
      student_id: newUserId,
    });
    if (wsStudentErr) {
      console.error("[tenant/create-user] workspace_students insert:", wsStudentErr);
      return res.status(500).json({ error: "Failed to add student to workspace" });
    }
    if (classroomIds.length > 0) {
      const { data: validClassrooms } = await supabaseAdmin
        .from("classrooms")
        .select("id")
        .eq("workspace_id", workspaceId)
        .in("id", classroomIds);
      const validIds = (validClassrooms ?? []).map((c) => c.id);
      for (const classroomId of validIds) {
        const { error: enrollErr } = await supabaseAdmin.from("enrollments").insert({
          classroom_id: classroomId,
          student_id: newUserId,
          status: "active",
        });
        if (enrollErr) {
          console.error("[tenant/create-user] enrollments insert:", enrollErr);
        }
      }
    }
  }

  let creditsAssigned = true;
  let creditsError: string | undefined;
  let storageAssigned = true;
  let storageError: string | undefined;

  if (initialCredits > 0) {
    const { data: assignData, error: creditErr } = await supabaseAdmin.rpc("assign_credits_to_member", {
      _workspace_id: workspaceId,
      _member_user_id: newUserId,
      _credits: initialCredits,
      _caller_user_id: caller.id,
    });
    if (creditErr) {
      console.error("[tenant/create-user] assign_credits_to_member error:", creditErr);
      creditsAssigned = false;
      creditsError = creditErr.message ?? "Failed to deduct credits from workspace pool.";
    } else {
      const result = assignData as { ok?: boolean; error?: string } | null;
      if (!result?.ok) {
        creditsAssigned = false;
        creditsError = result?.error ?? "Insufficient credits in workspace pool or pool not set up.";
      }
    }
  }

  if (initialStorageMb > 0) {
    const { data: assignData, error: storageErr } = await supabaseAdmin.rpc("assign_storage_to_member", {
      _workspace_id: workspaceId,
      _member_user_id: newUserId,
      _storage_limit_mb: initialStorageMb,
      _caller_user_id: caller.id,
    });
    if (storageErr) {
      console.error("[tenant/create-user] assign_storage_to_member error:", storageErr);
      storageAssigned = false;
      storageError = storageErr.message ?? "Failed to assign storage from workspace pool.";
    } else {
      const result = assignData as { ok?: boolean; error?: string } | null;
      if (!result?.ok) {
        storageAssigned = false;
        storageError = result?.error ?? "Insufficient storage in workspace pool.";
      }
    }
  }

  return res.status(200).json({
    success: true,
    userId: newUserId,
    email,
    role,
    message:
      role === "tutor"
        ? "Tutor account created. Share the login details with them."
        : "Student account created. Share the login details with them.",
    creditsAssigned,
    storageAssigned,
    ...(creditsError && { creditsError }),
    ...(storageError && { storageError }),
  });
}
