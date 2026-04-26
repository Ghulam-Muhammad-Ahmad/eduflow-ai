"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Video,
  FileText,
  Receipt,
  Clock,
  ArrowRight,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityItem } from "../../../../../pages/api/owner/activities";

// ── Status config ────────────────────────────────────────────────────────────
const statusConfig: Record<
  string,
  { label: string; className: string }
> = {
  // Sessions
  completed:      { label: "Completed",     className: "bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]" },
  scheduled:      { label: "Scheduled",     className: "bg-primary/10 text-primary" },
  in_progress:    { label: "In Progress",   className: "bg-[hsl(var(--accent)/0.3)] text-foreground" },
  cancelled:      { label: "Cancelled",     className: "bg-muted text-muted-foreground" },
  failed:         { label: "Failed",        className: "bg-destructive/10 text-destructive" },
  // Contracts
  signed:         { label: "Signed",        className: "bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]" },
  pending_tutor:  { label: "Awaiting Tutor","className": "bg-primary/10 text-primary" },
  pending_owner:  { label: "Needs Review",  className: "bg-destructive/10 text-destructive" },
  // Invoices
  paid:           { label: "Paid",          className: "bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]" },
  unpaid:         { label: "Unpaid",        className: "bg-destructive/10 text-destructive" },
  proof_submitted:{ label: "Proof Sent",    className: "bg-primary/10 text-primary" },
};

// ── Type icon ────────────────────────────────────────────────────────────────
const typeIcon: Record<ActivityItem["type"], React.ReactNode> = {
  session:    <Video className="h-4 w-4" />,
  contract:   <FileText className="h-4 w-4" />,
  invoice:    <Receipt className="h-4 w-4" />,
  enrollment: <CalendarDays className="h-4 w-4" />,
};

const typeHref: Record<ActivityItem["type"], string> = {
  session:    "/dashboard/owner/sessions",
  contract:   "/dashboard/owner/contracts",
  invoice:    "/dashboard/owner/billing",
  enrollment: "/dashboard/owner/students",
};

const typeBg: Record<ActivityItem["type"], string> = {
  session:    "bg-primary/10 text-primary",
  contract:   "bg-[hsl(var(--brand-lime)/0.2)] text-foreground",
  invoice:    "bg-destructive/10 text-destructive",
  enrollment: "bg-muted text-muted-foreground",
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency || "GBP",
    minimumFractionDigits: 0,
  }).format(amount);
}

// ── Component ────────────────────────────────────────────────────────────────
export function ActivitiesTable() {
  const { data, isLoading } = useQuery({
    queryKey: ["owner-activities"],
    queryFn: async () => {
      const res = await fetch("/api/owner/activities", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load activities");
      return res.json() as Promise<{ activities: ActivityItem[] }>;
    },
    refetchInterval: 30_000,
  });

  const activities = data?.activities ?? [];

  return (
    <Card className="shadow-[var(--shadow-subtle)]">
      <CardHeader className="flex flex-row items-center justify-between pb-4 pt-5 px-5">
        <div>
          <CardTitle className="text-lg font-bold">Recent Activities</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Sessions, contracts and invoices — last 7 days</p>
        </div>
        <Link href="/dashboard/owner/sessions">
          <Button variant="ghost" size="sm" className="text-xs gap-1 text-muted-foreground hover:text-foreground">
            View All <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </CardHeader>

      <CardContent className="px-0 pb-2">
        {/* Table header */}
        <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-4 items-center px-5 pb-2 border-b">
          <span />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Activity</span>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right hidden sm:block">Amount</span>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Status</span>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Date</span>
        </div>

        {/* Rows */}
        {isLoading ? (
          <div className="px-5 space-y-3 pt-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-48" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-3.5 w-14" />
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
            <Clock className="h-8 w-8 opacity-30" />
            <p className="text-sm">No activity in the last 7 days</p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {activities.map((item) => {
              const status = statusConfig[item.status] ?? {
                label: item.status,
                className: "bg-muted text-muted-foreground",
              };

              return (
                <Link
                  key={item.id}
                  href={typeHref[item.type]}
                  className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-4 items-center px-5 py-3.5 hover:bg-muted/50 transition-colors group"
                >
                  {/* Icon */}
                  <div className={cn(
                    "h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105",
                    typeBg[item.type]
                  )}>
                    {typeIcon[item.type]}
                  </div>

                  {/* Title + description */}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                  </div>

                  {/* Amount */}
                  <span className="text-sm font-medium text-right hidden sm:block tabular-nums">
                    {item.amount != null
                      ? formatAmount(item.amount, item.currency ?? "GBP")
                      : <span className="text-muted-foreground">—</span>}
                  </span>

                  {/* Status badge */}
                  <span className={cn(
                    "text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap",
                    status.className
                  )}>
                    {status.label}
                  </span>

                  {/* Date */}
                  <span className="text-xs text-muted-foreground text-right whitespace-nowrap">
                    {formatRelative(item.date)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
