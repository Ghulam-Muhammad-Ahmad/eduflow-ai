/**
 * Fee engine: creates student_invoice_rows when a session is completed (per_session/per_hour)
 * or when monthly cron runs (monthly_fixed). Used by session-complete API and cron.
 */
import { supabaseAdmin } from "@/integrations/supabase/admin";

function assertAdmin() {
  if (!supabaseAdmin) throw new Error("Server configuration error");
  return supabaseAdmin;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Resolve student IDs for a session: one-to-one => [session.student_id], classroom => enrollments (active).
 */
async function getSessionStudentIds(params: {
  scopeType: string;
  classroomId: string | null;
  studentId: string | null;
}): Promise<string[]> {
  if (params.scopeType === "one_to_one") {
    return params.studentId ? [params.studentId] : [];
  }
  if (!params.classroomId) return [];

  const admin = assertAdmin();
  const { data: enrollments, error } = await admin
    .from("enrollments")
    .select("student_id")
    .eq("classroom_id", params.classroomId)
    .eq("status", "active");

  if (error) throw error;
  return Array.from(new Set((enrollments ?? []).map((e) => e.student_id)));
}

/**
 * Run fee engine for a completed session: for each student, load active fee configs
 * (per_session, per_hour), compute amount, insert student_invoice_rows.
 */
export async function runFeeEngineForSession(params: {
  workspaceId: string;
  sessionId: string;
  scopeType: string;
  classroomId: string | null;
  studentId: string | null;
  startsAt: string;
  endsAt: string;
}): Promise<void> {
  const admin = assertAdmin();
  const studentIds = await getSessionStudentIds({
    scopeType: params.scopeType,
    classroomId: params.classroomId,
    studentId: params.studentId,
  });

  if (studentIds.length === 0) return;

  const startMs = new Date(params.startsAt).getTime();
  const endMs = new Date(params.endsAt).getTime();
  const durationMinutes = Math.max(0, Math.round((endMs - startMs) / 60_000));
  const durationHours = durationMinutes / 60;
  const sessionDate = params.startsAt.slice(0, 10);
  const dueDate = sessionDate; // or +7 days per plan; using session date for simplicity

  for (const sid of studentIds) {
    const { data: configs, error: configError } = await admin
      .from("student_fee_configs")
      .select("id, fee_type, amount, currency, description")
      .eq("workspace_id", params.workspaceId)
      .eq("student_id", sid)
      .eq("active", true)
      .in("fee_type", ["per_session", "per_hour"]);

    if (configError) throw configError;
    if (!configs?.length) continue;

    for (const cfg of configs as Array<{
      id: string;
      fee_type: string;
      amount: number;
      currency: string;
      description: string | null;
    }>) {
      let amount: number;
      if (cfg.fee_type === "per_session") {
        amount = roundCurrency(Number(cfg.amount));
      } else {
        amount = roundCurrency(Number(cfg.amount) * durationHours);
      }
      if (amount <= 0) continue;

      const description =
        cfg.description ||
        (cfg.fee_type === "per_session" ? "Session fee" : `Session fee (${durationHours.toFixed(1)}h)`);

      await admin.from("student_invoice_rows").insert({
        workspace_id: params.workspaceId,
        student_id: sid,
        fee_config_id: cfg.id,
        session_id: params.sessionId,
        invoice_type: "session_fee",
        description,
        amount,
        currency: (cfg.currency || "GBP").trim(),
        due_date: dueDate,
        status: "unpaid",
      });
    }
  }
}

/**
 * Monthly path: for each active student_fee_config with fee_type = monthly_fixed,
 * insert one invoice row for the current month if not already present (idempotent).
 */
export async function runFeeEngineForMonth(params: {
  periodDate: string; // YYYY-MM-DD, typically 1st of month
}): Promise<void> {
  const admin = assertAdmin();
  const periodDate = params.periodDate.slice(0, 10);

  const { data: configs, error: configError } = await admin
    .from("student_fee_configs")
    .select("id, workspace_id, student_id, amount, currency, description")
    .eq("active", true)
    .eq("fee_type", "monthly_fixed");

  if (configError) throw configError;
  if (!configs?.length) return;

  const monthLabel = new Date(periodDate + "T12:00:00Z").toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  for (const cfg of configs as Array<{
    id: string;
    workspace_id: string;
    student_id: string;
    amount: number;
    currency: string;
    description: string | null;
  }>) {
    const { data: existing } = await admin
      .from("student_invoice_rows")
      .select("id")
      .eq("student_id", cfg.student_id)
      .eq("fee_config_id", cfg.id)
      .eq("invoice_type", "monthly_fee")
      .eq("due_date", periodDate)
      .limit(1)
      .maybeSingle();

    if (existing) continue;

    const amount = roundCurrency(Number(cfg.amount));
    if (amount <= 0) continue;

    const description = cfg.description || `Monthly fee – ${monthLabel}`;

    await admin.from("student_invoice_rows").insert({
      workspace_id: cfg.workspace_id,
      student_id: cfg.student_id,
      fee_config_id: cfg.id,
      session_id: null,
      invoice_type: "monthly_fee",
      description,
      amount,
      currency: (cfg.currency || "GBP").trim(),
      due_date: periodDate,
      status: "unpaid",
    });
  }
}
