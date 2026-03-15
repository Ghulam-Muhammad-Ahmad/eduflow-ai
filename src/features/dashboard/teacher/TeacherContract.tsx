"use client";

import ReactMarkdown from "react-markdown";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useTutorContract } from "@/hooks/useTutorContract";
import { ArrowLeft, FileText, Download } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";
import { toast } from "sonner";

type ContractWithStatus = ReturnType<typeof useTutorContract>["contract"] & {
  contract_type?: string;
  start_date?: string;
  end_date?: string | null;
  status?: string;
};

export default function TeacherContract() {
  const { contract, isLoading } = useTutorContract();
  const c = contract as ContractWithStatus | null;

  const handleDownload = async () => {
    if (!contract?.id) return;
    try {
      const res = await fetch(`/api/contracts/download?tutor_contract_id=${encodeURIComponent(contract.id)}`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        toast.error(data.error ?? "Failed to get download link");
        return;
      }
      window.open(data.url, "_blank");
    } catch {
      toast.error("Failed to download");
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[200px]">
          <Spinner size="lg" className="text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  const contractType = c?.contract_type ?? c?.pay_type ?? "—";
  const status = c?.status ?? c?.contract_status ?? "—";
  const rateLabel = c
    ? `${c.rate_amount} ${c.rate_currency}/${contractType === "per_session" ? "session" : contractType === "fixed_monthly" ? "month" : "hr"}`
    : "—";

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-in fade-in duration-300">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/teacher">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>

        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="h-8 w-8 text-primary" />
            <h1 className="text-xl font-bold">My contract</h1>
          </div>

          {!c ? (
            <p className="text-muted-foreground">No contract record found for your workspace.</p>
          ) : (
            <div className="space-y-6">
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Type</dt>
                  <dd className="mt-0.5 font-medium capitalize">{String(contractType).replace("_", " ")}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Rate</dt>
                  <dd className="mt-0.5 font-medium">{rateLabel}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Currency</dt>
                  <dd className="mt-0.5 font-medium">{c.rate_currency ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Start date</dt>
                  <dd className="mt-0.5 font-medium">{c.start_date ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</dt>
                  <dd className="mt-0.5 font-medium capitalize">{String(status).replace("_", " ")}</dd>
                </div>
              </dl>

              {c.contract_storage_path && (
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              )}

              {c.contract_body_text && (
                <div className="rounded-lg border border-border bg-muted/30 p-4 max-h-[400px] overflow-y-auto prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{c.contract_body_text}</ReactMarkdown>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
