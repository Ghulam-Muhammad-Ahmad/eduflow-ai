"use client";

import { useMemo } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Wallet,
  TrendingUp,
  AlertCircle,
  Clock,
  Users,
  RefreshCw,
  Zap,
  HardDrive,
  FileCheck,
} from "lucide-react";
import { useOwnerDashboardData } from "./hooks/useOwnerDashboardData";
import { MetricCard } from "./components/MetricCard";
import { RevenueTrendChart } from "./components/RevenueTrendChart";
import { SessionTrendChart } from "./components/SessionTrendChart";
import type { Alert } from "./components/AlertCard";
import { QuickActionsCard } from "./components/QuickActionsCard";
import { useWorkspaceCurrency } from "@/hooks/useWorkspaceCurrency";
import { ActivitiesTable } from "./components/ActivitiesTable";

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency || "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function OwnerDashboardEnhanced() {
  const { data, isLoading, refetch, lastUpdateTime } = useOwnerDashboardData();
  const workspaceCurrency = useWorkspaceCurrency();

  const alerts: Alert[] = useMemo(() => {
    const alertsList: Alert[] = [];

    if (data.alerts.pendingContracts > 0) {
      alertsList.push({
        id: "pending-contracts",
        type: "pending",
        title: "Pending Contracts",
        description: "Unsigned tutor contracts awaiting action",
        count: data.alerts.pendingContracts,
        icon: <FileCheck className="h-4 w-4" />,
        action: { label: "Review", href: "/dashboard/owner/contracts" },
      });
    }
    if (data.alerts.failedSessionsLastWeek > 0) {
      alertsList.push({
        id: "failed-sessions",
        type: "error",
        title: "Failed Sessions",
        description: "Sessions with technical issues in the last 7 days",
        count: data.alerts.failedSessionsLastWeek,
        icon: <AlertCircle className="h-4 w-4" />,
        action: { label: "Review", href: "/dashboard/owner/sessions" },
      });
    }
    if (data.alerts.creditUsagePercent > 80) {
      alertsList.push({
        id: "credit-usage",
        type: "warning",
        title: "High Credit Usage",
        description: `${data.alerts.creditUsagePercent}% of monthly credits used`,
        icon: <Zap className="h-4 w-4" />,
        action: { label: "Manage", href: "/dashboard/owner/billing" },
      });
    }
    if (data.alerts.storageUsagePercent > 80) {
      alertsList.push({
        id: "storage-usage",
        type: "warning",
        title: "Storage Limit",
        description: `${data.alerts.storageUsagePercent}% of storage used`,
        icon: <HardDrive className="h-4 w-4" />,
        action: { label: "Upgrade", href: "/dashboard/owner/billing" },
      });
    }

    return alertsList;
  }, [data.alerts]);

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-8">

        {/* ── Row 1: Primary KPI cards ───────────────── */}
        <div className="grid grid-cols-2 gap-4">
          <MetricCard
            layout="horizontal"
            label="Total Sessions"
            value={data.engagement.sessionsThisMonth.toString()}
            icon={<Clock className="h-4 w-4" />}
            subtext="This month"
            accentColor="primary"
            loading={isLoading}
            href="/dashboard/owner/sessions"
          />
          <MetricCard
            layout="horizontal"
            label="Total Earnings"
            value={formatCurrency(data.finance.revenueThisMonth, workspaceCurrency)}
            icon={<TrendingUp className="h-4 w-4" />}
            subtext="Collected"
            accentColor="accent"
            loading={isLoading}
            href="/dashboard/owner/finance"
          />
          <MetricCard
            layout="horizontal"
            label="Pending Payouts"
            value={formatCurrency(data.finance.pendingPayouts, workspaceCurrency)}
            icon={<Wallet className="h-4 w-4" />}
            subtext="Tutors"
            accentColor="primary"
            loading={isLoading}
            href="/dashboard/owner/payouts"
          />
          <MetricCard
            layout="horizontal"
            label="Active Users"
            value={`${data.engagement.activeStudents + data.engagement.activeTutors}`}
            icon={<Users className="h-4 w-4" />}
            subtext="Students & tutors"
            accentColor="primary"
            loading={isLoading}
            href="/dashboard/owner/students"
          />
        </div>

        {/* ── Row 2: Session chart + Revenue chart ────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <SessionTrendChart data={data.engagement.sessionTrend} loading={isLoading} />
          </div>
          <div>
            <RevenueTrendChart
              data={data.finance.revenueTrend}
              loading={isLoading}
              currency={workspaceCurrency}
            />
          </div>
        </div>

        {/* ── Row 3: Quick Actions + Finance KPIs ────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          <div className="lg:col-span-2 flex flex-col">
            <QuickActionsCard pendingContracts={data.alerts.pendingContracts} />
          </div>
          <div className="flex flex-col gap-6">
            <MetricCard
              label="Unpaid Invoices"
              value={formatCurrency(data.finance.outstanding, workspaceCurrency)}
              icon={<AlertCircle className="h-4 w-4" />}
              subtext="Earned but not collected"
              accentColor="destructive"
              loading={isLoading}
              href="/dashboard/owner/finance"
            />
            <MetricCard
              label="Monthly Revenue"
              value={formatCurrency(data.finance.mrr, workspaceCurrency)}
              icon={<TrendingUp className="h-4 w-4" />}
              subtext="Expected each month"
              accentColor="accent"
              loading={isLoading}
              href="/dashboard/owner/finance"
            />
          </div>
        </div>

        {/* ── Row 4: Activities Table ──────────────────── */}
        <ActivitiesTable />

        {/* ── Footer ───────────────────────────────────── */}
        <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-4">
          <span>Last updated: {new Date(lastUpdateTime).toLocaleTimeString()}</span>
          <div className="flex gap-4">
            <Link href="/dashboard/owner/finance" className="hover:text-foreground transition-colors">Finance Details →</Link>
            <Link href="/dashboard/owner/sessions" className="hover:text-foreground transition-colors">All Sessions →</Link>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
