"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FileText, PenLine, Search, Eye, Sparkles } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

const contractStatusLabel: Record<string, string> = {
  draft: "Draft",
  pending_signature: "Pending signature",
  signed: "Signed",
  change_requested: "Change requested",
};

export default function OwnerContractsList() {
  const { workspace, tutors, tutorContracts, isLoading } = useOwnerWorkspace();
  const [searchQuery, setSearchQuery] = useState("");

  const getTutorName = (tutorId: string) => {
    const t = tutors.find((x) => x.user_id === tutorId);
    return (t?.profile?.display_name ?? t?.profile?.email ?? "Tutor") as string;
  };

  const filteredContracts = useMemo(() => {
    if (!searchQuery.trim()) return tutorContracts;
    const q = searchQuery.toLowerCase().trim();
    return tutorContracts.filter((c) => {
      const name = getTutorName(c.tutor_id).toLowerCase();
      const statusLabel = (contractStatusLabel[c.contract_status] ?? c.contract_status).toLowerCase();
      const rateStr = `${c.rate_amount} ${c.rate_currency}`.toLowerCase();
      return name.includes(q) || statusLabel.includes(q) || rateStr.includes(q);
    });
  }, [tutorContracts, searchQuery, tutors]);

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
            <Spinner size="lg" className="text-muted-foreground" />
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
            <div className="p-4 border-b border-border">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden />
                <Input
                  type="search"
                  placeholder="Search by tutor name, status, or rate..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  aria-label="Search contracts"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-3 font-medium text-muted-foreground text-sm">Tutor</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground text-sm">Status</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground text-sm">Rate</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground text-sm hidden sm:table-cell">Signed</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground text-sm w-32">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContracts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No contracts match &quot;{searchQuery}&quot;. Try a different search.
                      </td>
                    </tr>
                  ) : filteredContracts.map((c) => {
                    const name = getTutorName(c.tutor_id);
                    const hasBody = !!c.contract_body_text;
                    const statusLabel = contractStatusLabel[c.contract_status] ?? c.contract_status;
                    const payType = (c as { contract_type?: string }).contract_type ?? c.pay_type;
                    const rateUnit = payType === "per_session" ? "session" : payType === "fixed_monthly" ? "month" : "hour";
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
                          {hasBody ? (
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
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {hasBody ? `${c.rate_amount} ${c.rate_currency} / ${rateUnit}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground hidden sm:table-cell">
                          {hasBody && c.contract_signed_at
                            ? new Date(c.contract_signed_at).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {hasBody ? (
                            <Button variant="default" size="sm" asChild>
                              <Link href={`/dashboard/owner/contracts/${c.id}`} className="inline-flex items-center gap-2">
                                <Eye className="h-4 w-4" />
                                View
                              </Link>
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/dashboard/owner/contracts/new?tutorId=${c.tutor_id}`} className="inline-flex items-center gap-2">
                                <Sparkles className="h-4 w-4" />
                                Build via AI
                              </Link>
                            </Button>
                          )}
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
