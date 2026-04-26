import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getWorkspaceIdForOwner } from "@/server/storage-allocation";

interface DashboardDataResponse {
  finance: {
    mrr: number;
    revenueThisMonth: number;
    outstanding: number;
    pendingPayouts: number;
    revenueTrend: Array<{ date: string; amount: number }>;
  };
  engagement: {
    activeStudents: number;
    activeTutors: number;
    sessionsThisMonth: number;
    avgSessionDuration: number;
    sessionTrend: Array<{ date: string; count: number }>;
  };
  alerts: {
    pendingContracts: number;
    failedSessionsLastWeek: number;
    creditUsagePercent: number;
    storageUsagePercent: number;
  };
}

function sumByCurrency(
  rows: Array<{ currency?: string | null; amount?: number | null }>,
  amountKey: "amount" | "net_amount" | "total_net_amount" = "amount"
): number {
  let total = 0;
  for (const row of rows) {
    const amount = Number(row[amountKey as keyof typeof row] ?? 0);
    total += amount;
  }
  return Math.round(total * 100) / 100;
}

function getTrendData(
  rows: Array<{ created_at?: string; paid_at?: string; amount?: number; count?: number }>,
  days: number,
  dateKey: "created_at" | "paid_at" = "created_at"
): Array<{ date: string; amount: number }> {
  const now = new Date();
  const trendMap = new Map<string, number>();

  // Initialize last N days with 0
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    trendMap.set(dateStr, 0);
  }

  // Add amounts from rows
  for (const row of rows) {
    const dateStr = (row[dateKey] ?? "").split("T")[0];
    if (trendMap.has(dateStr)) {
      const amount = Number(row.amount ?? 0);
      trendMap.set(dateStr, (trendMap.get(dateStr) ?? 0) + amount);
    }
  }

  return Array.from(trendMap.entries())
    .map(([date, amount]) => ({
      date,
      amount: Math.round(amount * 100) / 100,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function getSessionTrendData(
  rows: Array<{ created_at?: string; duration_seconds?: number }>,
  days: number
): Array<{ date: string; count: number }> {
  const now = new Date();
  const trendMap = new Map<string, number>();

  // Initialize last N days with 0
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    trendMap.set(dateStr, 0);
  }

  // Count sessions by date
  for (const row of rows) {
    const dateStr = (row.created_at ?? "").split("T")[0];
    if (trendMap.has(dateStr)) {
      trendMap.set(dateStr, (trendMap.get(dateStr) ?? 0) + 1);
    }
  }

  return Array.from(trendMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DashboardDataResponse | { error: string }>
) {
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
    return res
      .status(403)
      .json({ error: "Only workspace owners can access dashboard data" });
  }

  const now = new Date();
  const firstOfMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  );
  const firstOfMonthIso = firstOfMonth.toISOString();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  try {
    const [
      { data: paidThisMonth },
      { data: outstandingInvoices },
      { data: pendingPayouts },
      { data: revenueTrendData },
      { data: activeStudentsData },
      { data: activeTutorsData },
      { data: sessionsThisMonthData },
      { data: sessionsTrendData },
      { data: pendingContracts },
      { data: failedSessions },
      { data: creditPool },
    ] = await Promise.all([
      // Finance: Revenue This Month
      supabaseAdmin
        .from("student_invoice_rows")
        .select("amount")
        .eq("workspace_id", workspaceId)
        .eq("status", "paid")
        .gte("paid_at", firstOfMonthIso),

      // Finance: Outstanding Invoices
      supabaseAdmin
        .from("student_invoice_rows")
        .select("amount")
        .eq("workspace_id", workspaceId)
        .in("status", ["unpaid", "proof_submitted"]),

      // Finance: Pending Payouts (not yet paid)
      supabaseAdmin
        .from("tutor_payouts")
        .select("total_net_amount, currency")
        .eq("workspace_id", workspaceId)
        .is("paid_at", null),

      // Finance: Revenue Trend (90 days)
      supabaseAdmin
        .from("student_invoice_rows")
        .select("paid_at, amount")
        .eq("workspace_id", workspaceId)
        .eq("status", "paid")
        .gte("paid_at", ninetyDaysAgo.toISOString()),

      // Engagement: All Students in workspace
      supabaseAdmin
        .from("workspace_students")
        .select("user_id")
        .eq("workspace_id", workspaceId),

      // Engagement: All Tutors in workspace
      supabaseAdmin
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspaceId)
        .eq("role", "tutor"),

      // Engagement: Sessions This Month
      supabaseAdmin
        .from("sessions")
        .select("starts_at, ends_at")
        .eq("workspace_id", workspaceId)
        .eq("status", "completed")
        .gte("starts_at", firstOfMonthIso),

      // Engagement: Session Trend (last 30 days)
      supabaseAdmin
        .from("sessions")
        .select("created_at")
        .eq("workspace_id", workspaceId)
        .eq("status", "completed")
        .gte("created_at", thirtyDaysAgo.toISOString()),

      // Alerts: Pending Contracts
      supabaseAdmin
        .from("tutor_contracts")
        .select("id")
        .eq("workspace_id", workspaceId)
        .or("owner_signature_url.is.null,tutor_signature_url.is.null"),

      // Alerts: Failed Sessions (last 7 days)
      supabaseAdmin
        .from("sessions")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("status", "failed")
        .gte("created_at", sevenDaysAgo.toISOString()),

      // Alerts: Credit Pool Usage
      supabaseAdmin
        .from("workspace_credit_pools")
        .select("credits_allocated, credits_used_direct")
        .eq("workspace_id", workspaceId)
        .order("period", { ascending: false })
        .limit(1),
    ]);

    // Calculate metrics
    const revenueThisMonth = sumByCurrency(
      (paidThisMonth ?? []) as Array<{ amount: number }>
    );
    const outstanding = sumByCurrency(
      (outstandingInvoices ?? []) as Array<{ amount: number }>
    );
    const pendingPayoutsAmount = sumByCurrency(
      (pendingPayouts ?? []) as Array<{ currency?: string | null; total_net_amount?: number | null }>,
      "total_net_amount"
    );

    // MRR: Average of last 3 months paid invoices
    const mrrThisMonth = revenueThisMonth;

    // Total Students in workspace
    const activeStudents = (activeStudentsData ?? []).length;

    // Total Tutors in workspace
    const activeTutors = (activeTutorsData ?? []).length;

    // Sessions This Month: Count
    const sessionsThisMonth = sessionsThisMonthData?.length ?? 0;

    // Average Session Duration
    const avgDuration =
      (sessionsThisMonthData ?? []).reduce((sum: number, session: any) => {
        const start = new Date(session.starts_at).getTime();
        const end = new Date(session.ends_at).getTime();
        return sum + (end - start) / 1000; // Convert to seconds
      }, 0) / Math.max(sessionsThisMonth, 1);

    // Pending Contracts
    const pendingContractsCount = (pendingContracts ?? []).length;

    // Failed Sessions
    const failedSessionsCount = (failedSessions ?? []).length;

    // Credit Usage
    const creditData = creditPool?.[0];
    const creditsAllocated = creditData?.credits_allocated ?? 100;
    const creditsUsed = creditData?.credits_used_direct ?? 0;
    const creditUsagePercent = Math.round((creditsUsed / Math.max(creditsAllocated, 1)) * 100);

    // Storage Usage (placeholder - would need actual implementation)
    const storageUsagePercent = 45; // Mock value for now

    const response: DashboardDataResponse = {
      finance: {
        mrr: mrrThisMonth,
        revenueThisMonth,
        outstanding,
        pendingPayouts: pendingPayoutsAmount,
        revenueTrend: getTrendData(
          (revenueTrendData ?? []) as Array<{ paid_at: string; amount: number }>,
          90,
          "paid_at"
        ),
      },
      engagement: {
        activeStudents,
        activeTutors,
        sessionsThisMonth,
        avgSessionDuration: Math.round(avgDuration),
        sessionTrend: getSessionTrendData(
          (sessionsTrendData ?? []) as Array<{ created_at: string }>,
          30
        ),
      },
      alerts: {
        pendingContracts: pendingContractsCount,
        failedSessionsLastWeek: failedSessionsCount,
        creditUsagePercent,
        storageUsagePercent,
      },
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Dashboard data fetch error:", error);
    return res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
}
