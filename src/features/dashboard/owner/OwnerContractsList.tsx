"use client";

import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, ChevronRight, Loader2, PenLine } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const contractStatusLabel: Record<string, string> = {
  draft: "Draft",
  pending_signature: "Pending signature",
  signed: "Signed",
  change_requested: "Change requested",
};

export default function OwnerContractsList() {
  const { workspace, tutors, tutorContracts, isLoading } = useOwnerWorkspace();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const getTutorName = (tutorId: string) => {
    const t = tutors.find((x) => x.user_id === tutorId);
    return (t?.profile?.display_name ?? t?.profile?.email ?? "Tutor") as string;
  };

  const handleDownload = async (tutorContractId: string) => {
    setDownloadingId(tutorContractId);
    try {
      const res = await fetch(
        `/api/contracts/download?tutor_contract_id=${encodeURIComponent(tutorContractId)}`,
        { credentials: "include" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        toast.error(data.error ?? "Failed to get download link");
        return;
      }
      window.open(data.url, "_blank");
    } catch {
      toast.error("Failed to download");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Contracts</h1>
            <p className="text-muted-foreground">
              {workspace?.name ?? "Workspace"} · All tutor contracts in one place
            </p>
          </div>
          <Button asChild>
            <Link href="/dashboard/owner/contracts/new">
              <PenLine className="mr-2 h-4 w-4" />
              Build AI contract
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center min-h-[200px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : tutorContracts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
            <h2 className="mt-4 font-semibold">No contracts yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
            Create a tutor account from the Tutors tab to get a contract record. Then generate and share the contract.
            </p>
            <Button asChild className="mt-4">
              <Link href="/dashboard/owner/tutors">Go to Tutors</Link>
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-3 font-medium text-muted-foreground text-sm">Tutor</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground text-sm">Status</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground text-sm">Rate</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground text-sm hidden sm:table-cell">Signed</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground text-sm w-32">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tutorContracts.map((c) => {
                    const name = getTutorName(c.tutor_id);
                    const statusLabel = contractStatusLabel[c.contract_status] ?? c.contract_status;
                    return (
                      <tr key={c.id} className="border-b border-border last:border-b-0">
                        <td className="px-4 py-3">
                          <Link
                            href={`/dashboard/owner/tutors/${c.tutor_id}`}
                            className="font-medium text-foreground hover:underline"
                          >
                            {name}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              c.contract_status === "signed"
                                ? "default"
                                : c.contract_status === "change_requested"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {statusLabel}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {c.rate_amount} {c.rate_currency} / {c.pay_type === "per_session" ? "session" : "hour"}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground hidden sm:table-cell">
                          {c.contract_signed_at
                            ? new Date(c.contract_signed_at).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/dashboard/owner/contracts/${c.id}`} className="inline-flex items-center gap-1">
                                View contract
                                <ChevronRight className="h-4 w-4" />
                              </Link>
                            </Button>
                            {c.contract_storage_path && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownload(c.id)}
                                disabled={downloadingId === c.id}
                              >
                                {downloadingId === c.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Download className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/dashboard/owner/tutors/${c.tutor_id}`} className="text-muted-foreground text-xs">
                                Tutor profile
                              </Link>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
