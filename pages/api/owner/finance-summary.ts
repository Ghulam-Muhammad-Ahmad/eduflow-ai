import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getWorkspaceIdForOwner } from "@/server/storage-allocation";

type KpiByCurrency = { currency: string; amount: number }[];

export type RecentInvoiceRow = {
  id: string;
  student_id: string;
  description: string | null;
  amount: number;
  currency: string;
  due_date: string;
  status: string;
  student_display_name: string | null;
};

export type FinanceSummaryResponse = {
  pendingPayoutsByCurrency: KpiByCurrency;
  paidThisMonthByCurrency: KpiByCurrency;
  outstandingStudentFeesByCurrency: KpiByCurrency;
  collectedThisMonthByCurrency: KpiByCurrency;
  recentInvoices?: RecentInvoiceRow[];
};

function sumByCurrency(
  rows: Array<{ currency?: string | null; amount?: number | null }>,
  amountKey: "amount" | "net_amount" | "total_net_amount" = "amount"
): KpiByCurrency {
  const map = new Map<string, number>();
  for (const row of rows) {
    const currency = (row.currency || "GBP").trim().toUpperCase();
    const amount = Number(row[amountKey as keyof typeof row] ?? 0);
    map.set(currency, (map.get(currency) ?? 0) + amount);
  }
  return Array.from(map.entries()).map(([currency, amount]) => ({
    currency,
    amount: Math.round(amount * 100) / 100,
  }));
}

/**
 * GET /api/owner/finance-summary
 * Returns four KPIs for the owner finance dashboard (owner's workspace only).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { user, error: authError } = await getAuthUser(req, res);
  if (authError || !user) {
    return res.status(401).json({ error: authError?.message ?? "Unauthorized" });
  }
  if (!supabaseAdmin) {
    return res.status(503).json({ error: "Server configuration error" });
  }

  const workspaceId = await getWorkspaceIdForOwner(supabaseAdmin, user.id);
  if (!workspaceId) {
    return res.status(403).json({ error: "Only workspace owners can access finance summary" });
  }

  const now = new Date();
  const firstOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const firstOfMonthIso = firstOfMonth.toISOString();

  const [
    { data: pendingRows },
    { data: payouts },
    { data: outstandingInvoices },
    { data: paidInvoices },
  ] = await Promise.all([
    supabaseAdmin
      .from("tutor_earning_rows")
      .select("net_amount, currency")
      .eq("workspace_id", workspaceId)
      .in("status", ["pending", "approved"]),
    supabaseAdmin
      .from("tutor_payouts")
      .select("total_net_amount, currency")
      .eq("workspace_id", workspaceId)
      .gte("paid_at", firstOfMonthIso),
    supabaseAdmin
      .from("student_invoice_rows")
      .select("amount, currency")
      .eq("workspace_id", workspaceId)
      .in("status", ["unpaid", "proof_submitted"]),
    supabaseAdmin
      .from("student_invoice_rows")
      .select("amount, currency")
      .eq("workspace_id", workspaceId)
      .eq("status", "paid")
      .gte("paid_at", firstOfMonthIso),
  ]);

  const pendingPayoutsByCurrency = sumByCurrency(
    (pendingRows ?? []) as Array<{ net_amount: number; currency: string }>,
    "net_amount"
  );
  const paidThisMonthByCurrency = sumByCurrency(
    (payouts ?? []) as Array<{ total_net_amount: number; currency: string }>,
    "total_net_amount"
  );
  const outstandingStudentFeesByCurrency = sumByCurrency(
    (outstandingInvoices ?? []) as Array<{ amount: number; currency: string }>
  );
  const collectedThisMonthByCurrency = sumByCurrency(
    (paidInvoices ?? []) as Array<{ amount: number; currency: string }>
  );

  const { data: recentRows } = await supabaseAdmin
    .from("student_invoice_rows")
    .select("id, student_id, description, amount, currency, due_date, status")
    .eq("workspace_id", workspaceId)
    .in("status", ["unpaid", "proof_submitted", "paid"])
    .order("updated_at", { ascending: false })
    .limit(10);
  const studentIds = [...new Set((recentRows ?? []).map((r: { student_id: string }) => r.student_id))];
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("user_id, display_name")
    .in("user_id", studentIds);
  const profileMap = new Map((profiles ?? []).map((p: { user_id: string; display_name: string | null }) => [p.user_id, p.display_name]));
  const recentInvoices: RecentInvoiceRow[] = (recentRows ?? []).map(
    (r: { id: string; student_id: string; description: string | null; amount: number; currency: string; due_date: string; status: string }) => ({
      id: r.id,
      student_id: r.student_id,
      description: r.description,
      amount: r.amount,
      currency: r.currency,
      due_date: r.due_date,
      status: r.status,
      student_display_name: profileMap.get(r.student_id) ?? null,
    })
  );

  const body: FinanceSummaryResponse = {
    pendingPayoutsByCurrency,
    paidThisMonthByCurrency,
    outstandingStudentFeesByCurrency,
    collectedThisMonthByCurrency,
    recentInvoices,
  };
  return res.status(200).json(body);
}
