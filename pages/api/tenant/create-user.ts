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
  payType: (v: unknown) => v === undefined || v === "hourly" || v === "per_session",
  rateAmount: (v: unknown) => v === undefined || (typeof v === "number" && v >= 0) || (typeof v === "string" && /^\d+(\.\d+)?$/.test(v)),
  rateCurrency: (v: unknown) => v === undefined || (typeof v === "string" && v.trim().length <= 10),
  subjects: (v: unknown) =>
    v === undefined ||
    (Array.isArray(v) && v.every((s) => typeof s === "string")) ||
    (typeof v === "string" && (v === "" || v.trim().length >= 0)),
};

/**
 * Tenant-style account creation: only workspace owners can create tutors and students.
 * Email is unique system-wide (enforced by Supabase Auth).
 * Creates auth user + profile + user_roles + workspace_members (tutor) or tutor_student_assignments (student).
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
    initialCredits?: unknown;
    payType?: unknown;
    rateAmount?: unknown;
    rateCurrency?: unknown;
    subjects?: unknown;
  };

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
        "Invalid body: email, password, firstName, lastName, role (tutor|student) required; tutorId optional for student (owner must pass tutor when creating student).",
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
  const payType = bodySchema.payType(body.payType) ? (body.payType as "hourly" | "per_session") ?? "hourly" : "hourly";
  const rateAmount = bodySchema.rateAmount(body.rateAmount)
    ? typeof body.rateAmount === "number"
      ? body.rateAmount
      : parseFloat(String(body.rateAmount || 0))
    : 0;
  const rateCurrency = (bodySchema.rateCurrency(body.rateCurrency) ? (body.rateCurrency as string)?.trim() : null) || "GBP";
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
    .select("id")
    .eq("owner_id", caller.id)
    .limit(1)
    .maybeSingle();
  if (wsErr || !workspace) {
    return res.status(403).json({ error: "No workspace found for owner" });
  }
  const workspaceId = workspace.id;
  let assignmentTutorId: string;
  if (role === "student") {
    if (!tutorId) {
      return res.status(400).json({
        error: "When creating a student, tutorId is required so the student is assigned to a tutor.",
      });
    }
    const { data: tutorMember } = await supabaseAdmin
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", tutorId)
      .eq("role", "tutor")
      .maybeSingle();
    if (!tutorMember) {
      return res.status(400).json({ error: "Selected tutor is not in this workspace" });
    }
    assignmentTutorId = tutorId;
  } else {
    assignmentTutorId = ""; // unused for tutor
  }

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

  const accountType = role === "tutor" ? "solo_tutor" : "student";
  const now = new Date().toISOString();
  const { error: profileErr } = await supabaseAdmin
    .from("profiles")
    .update({
      display_name: displayName,
      email,
      account_type: accountType,
      onboarding_completed_at: now,
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
      pay_type: payType,
      rate_amount: rateAmount,
      rate_currency: rateCurrency,
      subjects: subjects.length ? subjects : [],
    });
    if (contractErr) {
      console.error("[tenant/create-user] tutor_contracts insert:", contractErr);
      return res.status(500).json({ error: "Failed to create tutor contract record" });
    }
  } else {
    const { error: assignErr } = await supabaseAdmin.from("tutor_student_assignments").insert({
      workspace_id: workspaceId,
      tutor_id: assignmentTutorId,
      student_id: newUserId,
    });
    if (assignErr) {
      console.error("[tenant/create-user] tutor_student_assignments insert:", assignErr);
      return res.status(500).json({ error: "Failed to assign student to tutor" });
    }
  }

  let creditsAssigned = true;
  let creditsError: string | undefined;

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
    ...(creditsError && { creditsError }),
  });
}
