"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Wallet,
  TrendingUp,
  FileWarning,
  Banknote,
  ArrowRight,
  Search,
  Receipt,
  AlertCircle,
  CheckCircle2,
  Download,
  User,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useWorkspaceCurrency } from "@/hooks/useWorkspaceCurrency";

type KpiByCurrency = { currency: string; amount: number }[];
type RecentInvoiceRow = {
  id: string;
  student_id: string;
  description: string | null;
  amount: number;
  currency: string;
  due_date: string;
  status: string;
  student_display_name: string | null;
};
type FinanceSummaryResponse = {
  pendingPayoutsByCurrency: KpiByCurrency;
  paidThisMonthByCurrency: KpiByCurrency;
  outstandingStudentFeesByCurrency: KpiByCurrency;
  collectedThisMonthByCurrency: KpiByCurrency;
  recentInvoices?: RecentInvoiceRow[];
};

type EarningRow = {
  id: string;
  tutor_id: string;
  period_date: string;
  description: string | null;
  net_amount: number;
  currency: string;
  status: string;
  earning_type: string;
};

function formatCurrency(amount: number, currency: string, fallback: string): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: (currency || fallback).trim() || "GBP",
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatKpiValue(byCurrency: { currency: string; amount: number }[], workspaceCurrency: string): string {
  if (byCurrency.length === 0) return "—";
  const primary = byCurrency.find((c) => (c.currency || "").trim() === workspaceCurrency) ?? byCurrency[0];
  if (byCurrency.length === 1) return formatCurrency(primary!.amount, primary!.currency, workspaceCurrency);
  return byCurrency.map((c) => formatCurrency(c.amount, c.currency, workspaceCurrency)).join(" · ");
}

export default function OwnerFinanceDashboard() {
  const [activeTab, setActiveTab] = useState<"tutor" | "student">("tutor");
  const [searchTutor, setSearchTutor] = useState("");
  const workspaceCurrency = useWorkspaceCurrency();

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["owner-finance-summary"],
    queryFn: async (): Promise<FinanceSummaryResponse> => {
      const res = await fetch("/api/owner/finance-summary", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load finance summary");
      return res.json();
    },
  });

  const { data: earningRows, isLoading: earningLoading } = useQuery({
    queryKey: ["owner-earning-rows"],
    queryFn: async (): Promise<{ rows: EarningRow[] }> => {
      const res = await fetch("/api/owner/earning-rows", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load earning rows");
      return res.json();
    },
  });

  const pendingRows = useMemo(() => {
    const rows = (earningRows?.rows ?? []) as EarningRow[];
    return rows.filter((r) => r.status === "pending" || r.status === "approved");
  }, [earningRows]);

  const recentInvoices = summary?.recentInvoices ?? [];

  const kpiCards = useMemo(() => {
    if (!summary) return [];
    return [
      {
        label: "Total Pending Payouts",
        value: formatKpiValue(summary.pendingPayoutsByCurrency, workspaceCurrency),
        icon: Wallet,
        accent: "primary" as const,
      },
      {
        label: "Paid This Month (Tutors)",
        value: formatKpiValue(summary.paidThisMonthByCurrency, workspaceCurrency),
        icon: Banknote,
        accent: "primary" as const,
      },
      {
        label: "Outstanding Student Fees",
        value: formatKpiValue(summary.outstandingStudentFeesByCurrency, workspaceCurrency),
        icon: FileWarning,
        accent: "accent" as const,
      },
      {
        label: "Collected This Month",
        value: formatKpiValue(summary.collectedThisMonthByCurrency, workspaceCurrency),
        icon: TrendingUp,
        accent: "success" as const,
      },
    ];
  }, [summary, workspaceCurrency]);

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-in fade-in duration-300">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
              Finance Dashboard
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Central hub for internal workspace finances and billing.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <Link href="/dashboard/owner/payouts">
                <Download className="h-4 w-4" />
                Payouts
              </Link>
            </Button>
            <Button size="sm" className="gap-2 bg-primary text-primary-foreground" asChild>
              <Link href="/dashboard/owner/students">
                <Receipt className="h-4 w-4" />
                Student Billing
              </Link>
            </Button>
          </div>
        </div>

        {/* KPI cards */}
        {summaryLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="border-border overflow-hidden">
                <CardContent className="p-6">
                  <Spinner size="sm" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpiCards.map((kpi, i) => (
              <Card
                key={kpi.label}
                className="border-border overflow-hidden relative overflow-hidden transition-all duration-200 hover:shadow-medium"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1 ${
                    kpi.accent === "primary"
                      ? "bg-primary"
                      : kpi.accent === "accent"
                        ? "bg-accent"
                        : "bg-[hsl(var(--success))]"
                  }`}
                />
                <CardContent className="p-5 pl-6">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {kpi.label}
                      </p>
                      <p className="text-xl font-bold text-foreground mt-1 tabular-nums">
                        {kpi.value}
                      </p>
                    </div>
                    <div
                      className={`rounded-lg p-2 ${
                        kpi.accent === "primary"
                          ? "bg-primary/10 text-primary"
                          : kpi.accent === "accent"
                            ? "bg-accent/10 text-[hsl(var(--accent-foreground))]"
                            : "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]"
                      }`}
                    >
                      <kpi.icon className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-border">
          <nav className="flex gap-6" aria-label="Finance tabs">
            <button
              type="button"
              onClick={() => setActiveTab("tutor")}
              className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === "tutor"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Tutor Payouts
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("student")}
              className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === "student"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Student Billing
            </button>
          </nav>
        </div>

        {/* Tab content */}
        {activeTab === "tutor" && (
          <Card className="border-border">
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-lg">Pending Tutor Earnings</CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search tutors..."
                    value={searchTutor}
                    onChange={(e) => setSearchTutor(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {earningLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Spinner size="lg" />
                </div>
              ) : pendingRows.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  No pending earnings. Completed sessions will create earning rows here.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">
                          Period / Description
                        </th>
                        <th className="text-left font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">
                          Type
                        </th>
                        <th className="text-right font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">
                          Amount
                        </th>
                        <th className="text-left font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">
                          Status
                        </th>
                        <th className="text-right font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingRows.slice(0, 12).map((row) => (
                        <tr
                          key={row.id}
                          className="border-b border-border/60 hover:bg-muted/20 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <span className="font-medium text-foreground">
                              {row.description || row.period_date}
                            </span>
                            <span className="block text-xs text-muted-foreground mt-0.5">
                              {row.period_date}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground capitalize">
                            {row.earning_type?.replace("_", " ") ?? "—"}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold tabular-nums">
                            {formatCurrency(Number(row.net_amount), row.currency, workspaceCurrency)}
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              variant={row.status === "approved" ? "success" : "neutral"}
                              className="capitalize"
                            >
                              {row.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button variant="link" size="sm" className="text-primary p-0 h-auto" asChild>
                              <Link href="/dashboard/owner/payouts">Process Payout</Link>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {pendingRows.length > 12 && (
                <div className="py-3 px-4 text-sm text-muted-foreground border-t border-border">
                  Showing 12 of {pendingRows.length} rows.{" "}
                  <Link href="/dashboard/owner/payouts" className="text-primary hover:underline">
                    View all in Payouts
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "student" && (
          <>
            <Card className="border-border">
              <CardHeader className="pb-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-lg">Recent Student Billing Activity</CardTitle>
                  <Button variant="link" size="sm" className="text-primary p-0 h-auto w-fit" asChild>
                    <Link href="/dashboard/owner/students">
                      View All Students
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {recentInvoices.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    No recent invoice activity.
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {recentInvoices.slice(0, 6).map((inv: RecentInvoiceRow) => (
                      <InvoiceActivityCard key={inv.id} invoice={inv} workspaceCurrency={workspaceCurrency} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function InvoiceActivityCard({ invoice, workspaceCurrency }: { invoice: RecentInvoiceRow; workspaceCurrency: string }) {
  const isProofSubmitted = invoice.status === "proof_submitted";
  const isOverdue =
    invoice.status === "unpaid" && new Date(invoice.due_date) < new Date();
  const isPaid = invoice.status === "paid";
  const studentName = invoice.student_display_name || "Student";

  return (
    <div
      className={`rounded-xl border p-4 flex items-center justify-between gap-4 transition-colors ${
        isProofSubmitted
          ? "border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/5"
          : isOverdue
            ? "border-destructive/30 bg-destructive/5"
            : "border-border bg-card"
      }`}
    >
      <div className="flex items-start gap-3 min-w-0">
        <div
          className={`shrink-0 rounded-lg p-2 ${
            isProofSubmitted
              ? "bg-[hsl(var(--success))]/10"
              : isOverdue
                ? "bg-destructive/10"
                : "bg-muted"
          }`}
        >
          {isProofSubmitted ? (
            <CheckCircle2 className="h-5 w-5 text-[hsl(var(--success))]" />
          ) : isOverdue ? (
            <AlertCircle className="h-5 w-5 text-destructive" />
          ) : (
            <Receipt className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0">
          <p className="font-medium text-foreground truncate">
            {isProofSubmitted ? "Proof Submitted" : isOverdue ? "Overdue" : "Paid"}: {invoice.description || `Invoice`}
          </p>
          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
            <User className="h-3.5 w-3.5 shrink-0" />
            {studentName} • {formatCurrency(invoice.amount, invoice.currency, workspaceCurrency || "GBP")}
          </p>
        </div>
      </div>
      <Button variant="secondary" size="sm" className="shrink-0" asChild>
        <Link href={`/dashboard/owner/students/${invoice.student_id}/billing`}>
          {isProofSubmitted ? "Review" : isOverdue ? "Remind" : "View"}
        </Link>
      </Button>
    </div>
  );
}
