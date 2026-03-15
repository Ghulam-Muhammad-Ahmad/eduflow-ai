/**
 * Contract engine: creates tutor_earning_rows when a session is completed (per_session/hourly)
 * or when monthly cron runs (fixed_monthly). Used by session-complete API and cron.
 */
import { supabaseAdmin } from "@/integrations/supabase/admin";

function assertAdmin() {
  if (!supabaseAdmin) throw new Error("Server configuration error");
  return supabaseAdmin;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

type ActiveContractRow = {
  id: string;
  workspace_id: string;
  tutor_id: string;
  rate_amount: number;
  rate_currency: string;
  contract_type: "fixed_monthly" | "per_session" | "hourly";
  platform_fee_pct: number;
  start_date: string;
  end_date: string | null;
};

/**
 * Load active contract for (workspace_id, tutor_id) valid for the given date.
 * contract_type IN (per_session, hourly) for session path; fixed_monthly for monthly path.
 */
export async function getActiveContract(params: {
  workspaceId: string;
  tutorId: string;
  contractTypes: Array<"fixed_monthly" | "per_session" | "hourly">;
  forDate: string; // YYYY-MM-DD
}): Promise<ActiveContractRow | null> {
  const admin = assertAdmin();
  const day = params.forDate.slice(0, 10);

  let query = admin
    .from("tutor_contracts")
    .select("id, workspace_id, tutor_id, rate_amount, rate_currency, contract_type, platform_fee_pct, start_date, end_date")
    .eq("workspace_id", params.workspaceId)
    .eq("tutor_id", params.tutorId)
    .eq("status", "active")
    .in("contract_type", params.contractTypes)
    .lte("start_date", day);

  const { data, error } = await query
    .or(`end_date.is.null,end_date.gte.${day}`)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as ActiveContractRow | null) ?? null;
}

/**
 * Session path: on session complete, create one earning row for per_session or hourly contract.
 */
export async function createEarningRowForSession(params: {
  workspaceId: string;
  tutorId: string;
  tutorContractId: string;
  sessionId: string;
  sessionTitle: string;
  periodDate: string; // YYYY-MM-DD (session date)
  startsAt: string;
  endsAt: string;
  grossAmount: number;
  platformFeePct: number;
  currency: string;
}): Promise<void> {
  const admin = assertAdmin();
  const platformFeeAmount = roundCurrency(params.grossAmount * (params.platformFeePct / 100));
  const netAmount = roundCurrency(params.grossAmount - platformFeeAmount);
  const description = params.sessionTitle
    ? `Session – ${params.sessionTitle}`
    : `Session – ${params.periodDate}`;

  const { error } = await admin.from("tutor_earning_rows").insert({
    workspace_id: params.workspaceId,
    tutor_id: params.tutorId,
    tutor_contract_id: params.tutorContractId,
    session_id: params.sessionId,
    earning_type: "session",
    period_date: params.periodDate,
    description,
    gross_amount: params.grossAmount,
    platform_fee_amount: platformFeeAmount,
    net_amount: netAmount,
    currency: params.currency,
    status: "pending",
  });

  if (error) throw error;
}

/**
 * Run contract engine for a single completed session: find active per_session/hourly contract,
 * compute gross (per_session: rate; hourly: rate * duration_hours), then insert earning row.
 */
export async function runContractEngineForSession(params: {
  workspaceId: string;
  tutorId: string;
  sessionId: string;
  sessionTitle: string;
  startsAt: string;
  endsAt: string;
}): Promise<void> {
  const contract = await getActiveContract({
    workspaceId: params.workspaceId,
    tutorId: params.tutorId,
    contractTypes: ["per_session", "hourly"],
    forDate: params.startsAt.slice(0, 10),
  });

  if (!contract) return;

  const startMs = new Date(params.startsAt).getTime();
  const endMs = new Date(params.endsAt).getTime();
  const durationMinutes = Math.max(0, Math.round((endMs - startMs) / 60_000));
  const durationHours = durationMinutes / 60;

  let gross: number;
  if (contract.contract_type === "per_session") {
    gross = roundCurrency(Number(contract.rate_amount));
  } else {
    gross = roundCurrency(Number(contract.rate_amount) * durationHours);
  }

  if (gross <= 0) return;

  await createEarningRowForSession({
    workspaceId: params.workspaceId,
    tutorId: params.tutorId,
    tutorContractId: contract.id,
    sessionId: params.sessionId,
    sessionTitle: params.sessionTitle,
    periodDate: params.startsAt.slice(0, 10),
    startsAt: params.startsAt,
    endsAt: params.endsAt,
    grossAmount: gross,
    platformFeePct: Number(contract.platform_fee_pct ?? 0),
    currency: (contract.rate_currency || "GBP").trim(),
  });
}

/**
 * Monthly path: create one earning row per active fixed_monthly contract for the given month (1st).
 * Idempotent: skip if a row already exists for (workspace_id, tutor_id, period_date) with earning_type = monthly_salary.
 */
export async function runContractEngineForMonth(params: {
  periodDate: string; // YYYY-MM-DD, typically 1st of month
}): Promise<void> {
  const admin = assertAdmin();
  const periodDate = params.periodDate.slice(0, 10);

  const { data: contracts, error: contractsError } = await admin
    .from("tutor_contracts")
    .select("id, workspace_id, tutor_id, rate_amount, rate_currency, platform_fee_pct")
    .eq("status", "active")
    .eq("contract_type", "fixed_monthly")
    .lte("start_date", periodDate)
    .or(`end_date.is.null,end_date.gte.${periodDate}`);

  if (contractsError) throw contractsError;
  if (!contracts?.length) return;

  const monthLabel = new Date(periodDate + "T12:00:00Z").toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  for (const c of contracts as Array<{
    id: string;
    workspace_id: string;
    tutor_id: string;
    rate_amount: number;
    rate_currency: string;
    platform_fee_pct: number | null;
  }>) {
    const { data: existing } = await admin
      .from("tutor_earning_rows")
      .select("id")
      .eq("workspace_id", c.workspace_id)
      .eq("tutor_id", c.tutor_id)
      .eq("period_date", periodDate)
      .eq("earning_type", "monthly_salary")
      .limit(1)
      .maybeSingle();

    if (existing) continue;

    const gross = roundCurrency(Number(c.rate_amount));
    const platformFeePct = Number(c.platform_fee_pct ?? 0);
    const platformFeeAmount = roundCurrency(gross * (platformFeePct / 100));
    const netAmount = roundCurrency(gross - platformFeeAmount);

    await admin.from("tutor_earning_rows").insert({
      workspace_id: c.workspace_id,
      tutor_id: c.tutor_id,
      tutor_contract_id: c.id,
      session_id: null,
      earning_type: "monthly_salary",
      period_date: periodDate,
      description: `Monthly salary – ${monthLabel}`,
      gross_amount: gross,
      platform_fee_amount: platformFeeAmount,
      net_amount: netAmount,
      currency: (c.rate_currency || "GBP").trim(),
      status: "pending",
    });
  }
}
