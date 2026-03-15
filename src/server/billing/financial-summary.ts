/**
 * Real financial summary from tutor_earning_rows and student_invoice_rows.
 * Returns a shape compatible with the existing LectureFinancialSummaryPanel (MockFinancialSummary).
 */
import { supabaseAdmin } from "@/integrations/supabase/admin";

export type RealFinancialSummary = {
  completedSessions: number;
  scheduledSessions: number;
  completedDurationMinutes: number;
  participantCountTotal: number;
  tutorPayrollByCurrency: Array<{ currency: string; amount: number }>;
  studentChargesByCurrency: Array<{ currency: string; amount: number }>;
  lineItems: Array<{
    sessionId: string;
    title: string;
    status: string;
    scopeType: string;
    startsAt: string;
    endsAt: string;
    durationMinutes: number;
    participantCount: number;
    tutorPayrollAmount: number;
    tutorPayrollCurrency: string;
    studentChargeAmount: number;
    studentChargeCurrency: string;
    source: "contract_default" | "session_override";
  }>;
};

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function sumByCurrency(items: Array<{ currency: string; amount: number }>): Array<{ currency: string; amount: number }> {
  const map = new Map<string, number>();
  for (const item of items) {
    const c = (item.currency || "GBP").trim().toUpperCase();
    map.set(c, roundCurrency((map.get(c) ?? 0) + item.amount));
  }
  return Array.from(map.entries()).map(([currency, amount]) => ({ currency, amount }));
}

/**
 * Build real financial summary for a workspace (and optional tutorId filter).
 * Uses sessions for counts/duration and tutor_earning_rows / student_invoice_rows for amounts.
 */
export async function getRealFinancialSummary(params: {
  workspaceId: string;
  sessions: Array<{
    id: string;
    title: string;
    status: string;
    scope_type: string;
    starts_at: string;
    ends_at: string;
    classroom_id: string | null;
    student_id: string | null;
  }>;
  tutorId?: string | null;
}): Promise<RealFinancialSummary> {
  const admin = supabaseAdmin;
  if (!admin) throw new Error("Server configuration error");

  const completedSessions = params.sessions.filter((s) => s.status === "completed").length;
  const scheduledSessions = params.sessions.filter((s) => s.status === "scheduled").length;
  const completedList = params.sessions.filter((s) => s.status === "completed");
  const completedDurationMinutes = completedList.reduce((sum, s) => {
    const start = new Date(s.starts_at).getTime();
    const end = new Date(s.ends_at).getTime();
    return sum + Math.max(0, Math.round((end - start) / 60_000));
  }, 0);

  let earningQuery = admin
    .from("tutor_earning_rows")
    .select("id, session_id, period_date, description, net_amount, currency")
    .eq("workspace_id", params.workspaceId);
  if (params.tutorId) earningQuery = earningQuery.eq("tutor_id", params.tutorId);
  const { data: earningRows } = await earningQuery;
  const rows = (earningRows ?? []) as Array<{
    session_id: string | null;
    net_amount: number;
    currency: string;
  }>;

  let invoiceQuery = admin
    .from("student_invoice_rows")
    .select("session_id, amount, currency")
    .eq("workspace_id", params.workspaceId);
  const { data: invoiceRows } = await invoiceQuery;
  const invoices = (invoiceRows ?? []) as Array<{ session_id: string | null; amount: number; currency: string }>;

  const tutorPayrollByCurrency = sumByCurrency(rows.map((r) => ({ currency: r.currency, amount: Number(r.net_amount) })));
  const studentChargesByCurrency = sumByCurrency(
    invoices.map((i) => ({ currency: i.currency, amount: Number(i.amount) }))
  );

  const sessionIds = new Set(rows.filter((r) => r.session_id).map((r) => r.session_id as string));
  const lineItems: RealFinancialSummary["lineItems"] = [];
  for (const session of params.sessions.filter((s) => sessionIds.has(s.id))) {
    const sessionEarnings = rows.filter((r) => r.session_id === session.id);
    const sessionInvoices = invoices.filter((i) => i.session_id === session.id);
    const tutorAmount = sessionEarnings.reduce((s, r) => s + Number(r.net_amount), 0);
    const tutorCurrency = sessionEarnings[0]?.currency ?? "GBP";
    const studentAmount = sessionInvoices.reduce((s, i) => s + Number(i.amount), 0);
    const studentCurrency = sessionInvoices[0]?.currency ?? "GBP";
    const startMs = new Date(session.starts_at).getTime();
    const endMs = new Date(session.ends_at).getTime();
    const durationMinutes = Math.max(0, Math.round((endMs - startMs) / 60_000));
    lineItems.push({
      sessionId: session.id,
      title: session.title || "Session",
      status: session.status,
      scopeType: session.scope_type || "classroom",
      startsAt: session.starts_at,
      endsAt: session.ends_at,
      durationMinutes,
      participantCount: session.scope_type === "one_to_one" ? (session.student_id ? 1 : 0) : 0,
      tutorPayrollAmount: roundCurrency(tutorAmount),
      tutorPayrollCurrency: tutorCurrency,
      studentChargeAmount: roundCurrency(studentAmount),
      studentChargeCurrency: studentCurrency,
      source: "contract_default",
    });
  }
  const participantCountTotal = completedList.reduce((sum, s) => {
    return sum + (s.scope_type === "one_to_one" ? (s.student_id ? 1 : 0) : 0);
  }, 0);

  return {
    completedSessions,
    scheduledSessions,
    completedDurationMinutes,
    participantCountTotal,
    tutorPayrollByCurrency,
    studentChargesByCurrency,
    lineItems,
  };
}
