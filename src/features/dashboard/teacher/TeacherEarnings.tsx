"use client";

import { useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Wallet, History, ExternalLink } from "lucide-react";
import { useWorkspaceCurrency } from "@/hooks/useWorkspaceCurrency";

type EarningRow = {
  id: string;
  period_date: string;
  description: string | null;
  earning_type: string;
  gross_amount: number;
  net_amount: number;
  currency: string;
  status: string;
};

type PayoutRow = {
  id: string;
  total_net_amount: number;
  currency: string;
  payment_note: string | null;
  proof_storage_path: string | null;
  paid_at: string | null;
  created_at: string;
};

function formatCurrency(amount: number, currency: string, fallback: string): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: (currency || fallback).trim() || "GBP",
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function TeacherEarnings() {
  const [tab, setTab] = useState<"breakdown" | "payouts">("breakdown");
  const workspaceCurrency = useWorkspaceCurrency();

  const { data: rowsData, isLoading: rowsLoading } = useQuery({
    queryKey: ["teacher-earning-rows"],
    queryFn: async () => {
      const res = await fetch("/api/teacher/earning-rows", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load earnings");
      return res.json() as Promise<{ rows: EarningRow[] }>;
    },
  });

  const { data: payoutsData, isLoading: payoutsLoading } = useQuery({
    queryKey: ["teacher-payouts"],
    queryFn: async () => {
      const res = await fetch("/api/teacher/payouts", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load payouts");
      return res.json() as Promise<{ payouts: PayoutRow[] }>;
    },
  });

  const rows = (rowsData?.rows ?? []) as EarningRow[];
  const payouts = (payoutsData?.payouts ?? []) as PayoutRow[];

  const handleViewProof = async (payoutId: string) => {
    try {
      const res = await fetch(
        `/api/payment-proofs/url?entity=payout&id=${encodeURIComponent(payoutId)}`,
        { credentials: "include" }
      );
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        toast.error(data.error ?? "Could not load proof");
        return;
      }
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Failed to load proof");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-in fade-in duration-300">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
            My Earnings
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            View your earning rows and payout history.
          </p>
        </div>

        <div className="border-b border-border">
          <nav className="flex gap-6">
            <button
              type="button"
              onClick={() => setTab("breakdown")}
              className={`pb-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === "breakdown"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Earnings breakdown
            </button>
            <button
              type="button"
              onClick={() => setTab("payouts")}
              className={`pb-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === "payouts"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Payout history
            </button>
          </nav>
        </div>

        {tab === "breakdown" && (
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                Earning rows
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Session and monthly salary earnings.
              </p>
            </CardHeader>
            <CardContent>
              {rowsLoading ? (
                <div className="flex justify-center py-12">
                  <Spinner size="lg" />
                </div>
              ) : rows.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  No earning rows yet. Completed sessions will appear here.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">Date</th>
                        <th className="text-left font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">Description</th>
                        <th className="text-left font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">Type</th>
                        <th className="text-right font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">Gross</th>
                        <th className="text-right font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">Net</th>
                        <th className="text-left font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.id} className="border-b border-border/60 hover:bg-muted/20">
                          <td className="py-3 px-4 text-muted-foreground">{row.period_date}</td>
                          <td className="py-3 px-4">{row.description || "—"}</td>
                          <td className="py-3 px-4 text-muted-foreground capitalize">
                            {row.earning_type?.replace("_", " ") ?? "—"}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums">
                            {formatCurrency(Number(row.gross_amount), row.currency, workspaceCurrency)}
                          </td>
                          <td className="py-3 px-4 text-right font-medium tabular-nums">
                            {formatCurrency(Number(row.net_amount), row.currency, workspaceCurrency)}
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              variant={row.status === "paid" ? "success" : "neutral"}
                              className="capitalize"
                            >
                              {row.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {tab === "payouts" && (
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Payout history
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Past payouts from the workspace owner.
              </p>
            </CardHeader>
            <CardContent>
              {payoutsLoading ? (
                <div className="flex justify-center py-12">
                  <Spinner size="lg" />
                </div>
              ) : payouts.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  No payouts yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">Date</th>
                        <th className="text-right font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">Amount</th>
                        <th className="text-left font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">Note</th>
                        <th className="text-right font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">Proof</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payouts.map((p) => (
                        <tr key={p.id} className="border-b border-border/60 hover:bg-muted/20">
                          <td className="py-3 px-4 text-muted-foreground">
                            {p.paid_at
                              ? new Date(p.paid_at).toLocaleDateString("en-GB", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : new Date(p.created_at).toLocaleDateString("en-GB")}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold tabular-nums">
                            {formatCurrency(Number(p.total_net_amount), p.currency, workspaceCurrency)}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground max-w-[200px] truncate">
                            {p.payment_note || "—"}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {p.proof_storage_path ? (
                              <Button
                                variant="link"
                                size="sm"
                                className="text-primary p-0 h-auto gap-1"
                                onClick={() => handleViewProof(p.id)}
                              >
                                View proof
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
