"use client";

import { useRouter } from "next/router";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Wallet, FileText, Pencil } from "lucide-react";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
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
  session_id: string | null;
};

function formatCurrency(amount: number, currency: string, fallback: string): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: (currency || fallback).trim() || "GBP",
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function OwnerTutorPayout() {
  const router = useRouter();
  const { id: tutorId } = router.query;
  const { tutors, contractByTutorId, isLoading } = useOwnerWorkspace();
  const workspaceCurrency = useWorkspaceCurrency();

  const tutor = tutors.find((t) => t.user_id === tutorId);
  const contract = tutorId ? contractByTutorId.get(tutorId as string) : null;

  const { data: earningData, isLoading: rowsLoading } = useQuery({
    queryKey: ["owner-earning-rows", tutorId],
    queryFn: async () => {
      const res = await fetch(
        `/api/owner/earning-rows?tutorId=${encodeURIComponent(tutorId as string)}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to load earning rows");
      return res.json() as Promise<{ rows: EarningRow[] }>;
    },
    enabled: !!tutorId,
  });

  const rows = (earningData?.rows ?? []) as EarningRow[];
  const pendingTotal = rows
    .filter((r) => r.status === "pending" || r.status === "approved")
    .reduce((s, r) => s + Number(r.net_amount), 0);
  const paidTotal = rows
    .filter((r) => r.status === "paid")
    .reduce((s, r) => s + Number(r.net_amount), 0);
  const currency = rows[0]?.currency ?? workspaceCurrency;

  if (!tutorId && !router.isReady) return null;
  if (!isLoading && !tutor) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Button variant="ghost" asChild>
            <Link href="/dashboard/owner/tutors">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Tutors
            </Link>
          </Button>
          <p className="text-muted-foreground">Tutor not found.</p>
        </div>
      </DashboardLayout>
    );
  }

  const displayName = tutor?.profile?.display_name || tutor?.profile?.email || "Tutor";
  const contractType = (contract as { contract_type?: string } | undefined)?.contract_type ?? contract?.pay_type ?? "—";
  const rateLabel = contract
    ? `${contract.rate_amount} ${contract.rate_currency}/${contractType === "per_session" ? "session" : contractType === "fixed_monthly" ? "month" : "hr"}`
    : "—";

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-in fade-in duration-300">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/dashboard/owner/tutors/${tutorId}`} aria-label="Back to tutor">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
              Payout: {displayName}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Contract summary and earning rows for this tutor.
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Contract
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                Type: <span className="font-medium text-foreground capitalize">{String(contractType).replace("_", " ")}</span>
              </p>
              <p className="text-muted-foreground">
                Rate: <span className="font-medium text-foreground">{rateLabel}</span>
              </p>
              {contract && (
                <Button variant="outline" size="sm" className="mt-2 gap-1" asChild>
                  <Link href={`/dashboard/owner/contracts/${contract.id}`}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit contract
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" />
                Totals
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                Pending: <span className="font-semibold text-foreground tabular-nums">{formatCurrency(pendingTotal, currency, workspaceCurrency)}</span>
              </p>
              <p className="text-muted-foreground">
                Paid (all time): <span className="font-semibold text-foreground tabular-nums">{formatCurrency(paidTotal, currency, workspaceCurrency)}</span>
              </p>
              <Button variant="default" size="sm" className="mt-2 gap-1 bg-primary" asChild>
                <Link href="/dashboard/owner/payouts">Process payout</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">Earning rows</CardTitle>
            <p className="text-sm text-muted-foreground">
              Ledger of session and monthly salary earnings.
            </p>
          </CardHeader>
          <CardContent>
            {rowsLoading ? (
              <div className="flex justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : rows.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                No earning rows yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">Date</th>
                      <th className="text-left font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">Description</th>
                      <th className="text-left font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">Type</th>
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
                        <td className="py-3 px-4 text-right font-medium tabular-nums">
                          {formatCurrency(Number(row.net_amount), row.currency, workspaceCurrency)}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={row.status === "paid" ? "success" : row.status === "approved" ? "default" : "neutral"}
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
      </div>
    </DashboardLayout>
  );
}
