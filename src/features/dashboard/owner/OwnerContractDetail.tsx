"use client";

import { useRouter } from "next/router";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, FileText, Download, Loader2, PenLine, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function OwnerContractDetail() {
  const router = useRouter();
  const contractId = typeof router.query.id === "string" ? router.query.id : null;
  const { tutors, tutorContracts, invalidate, isLoading } = useOwnerWorkspace();
  const contract = contractId ? tutorContracts.find((c) => c.id === contractId) : null;
  const tutor = contract ? tutors.find((t) => t.user_id === contract.tutor_id) : null;
  const tutorName = tutor?.profile?.display_name ?? tutor?.profile?.email ?? "Tutor";

  const [revisePrompt, setRevisePrompt] = useState("");
  const [revising, setRevising] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [resettingStatus, setResettingStatus] = useState(false);

  const handleRevise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contract || !revisePrompt.trim()) return;
    setRevising(true);
    try {
      const res = await fetch("/api/contracts/revise-by-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tutor_contract_id: contract.id, prompt: revisePrompt.trim() }),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((data as { error?: string }).error ?? "Failed to revise");
        return;
      }
      toast.success("Contract revised");
      setRevisePrompt("");
      invalidate();
    } finally {
      setRevising(false);
    }
  };

  const handleExportPdf = async () => {
    if (!contract) return;
    setExporting(true);
    try {
      const res = await fetch("/api/contracts/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tutor_contract_id: contract.id }),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((data as { error?: string }).error ?? "Failed to export PDF");
        return;
      }
      toast.success("PDF exported");
      invalidate();
    } finally {
      setExporting(false);
    }
  };

  const handleDownload = async () => {
    if (!contract?.id) return;
    try {
      const res = await fetch(`/api/contracts/download?tutor_contract_id=${encodeURIComponent(contract.id)}`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !(data as { url?: string }).url) {
        toast.error((data as { error?: string }).error ?? "Failed to get download link");
        return;
      }
      window.open((data as { url: string }).url, "_blank");
    } catch {
      toast.error("Failed to download");
    }
  };

  const handleResetToPendingSignature = async () => {
    if (!contract?.id) return;
    setResettingStatus(true);
    try {
      const { error } = await supabase
        .from("tutor_contracts")
        .update({ contract_status: "pending_signature", change_request_note: null, change_requested_at: null })
        .eq("id", contract.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Contract ready for tutor to sign again");
      invalidate();
    } finally {
      setResettingStatus(false);
    }
  };

  if (!contractId || (!isLoading && !contract)) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Button variant="ghost" asChild>
            <Link href="/dashboard/owner/contracts">Back to Contracts</Link>
          </Button>
          <p className="text-muted-foreground">Contract not found.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Button variant="ghost" asChild>
            <Link href="/dashboard/owner/contracts">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Contracts
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/owner/tutors/${contract.tutor_id}`}>
              <User className="mr-2 h-4 w-4" />
              {tutorName}
            </Link>
          </Button>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Contract · {tutorName}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {contract.rate_amount} {contract.rate_currency} / {contract.pay_type === "per_session" ? "session" : "hour"}
            {contract.contract_signed_at && (
              <> · Signed {new Date(contract.contract_signed_at).toLocaleDateString()} by {contract.tutor_signature_name ?? "—"}</>
            )}
          </p>

          {contract.contract_status === "change_requested" && (
            <div className="mt-4 p-3 rounded-lg bg-muted/50">
              <p className="text-sm font-medium">Tutor requested a change</p>
              <p className="text-sm text-muted-foreground mt-1">{contract.change_request_note || "No note."}</p>
              <Button variant="secondary" size="sm" className="mt-2" onClick={handleResetToPendingSignature} disabled={resettingStatus}>
                {resettingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mark as updated (tutor can sign again)"}
              </Button>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-4">
            {(contract.contract_status === "draft" || contract.contract_status === "pending_signature" || contract.contract_status === "change_requested") &&
              contract.contract_body_text && (
              <>
                <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={exporting}>
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Export as PDF"}
                </Button>
              </>
            )}
            {contract.contract_storage_path && (
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </Button>
            )}
          </div>

          {(contract.contract_status === "draft" || contract.contract_status === "pending_signature" || contract.contract_status === "change_requested") &&
            contract.contract_body_text && (
            <form onSubmit={handleRevise} className="mt-6 space-y-2">
              <Label htmlFor="revise-prompt">Edit contract by prompt</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="revise-prompt"
                  value={revisePrompt}
                  onChange={(e) => setRevisePrompt(e.target.value)}
                  placeholder="e.g. Add a 30-day notice period"
                  className="flex-1"
                />
                <Button type="submit" disabled={revising || !revisePrompt.trim()}>
                  {revising ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
                </Button>
              </div>
            </form>
          )}

          {contract.contract_body_text ? (
            <div className="mt-6 rounded-lg border border-border bg-muted/20 p-4 max-h-[500px] overflow-y-auto prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{contract.contract_body_text}</ReactMarkdown>
            </div>
          ) : (
            <p className="mt-6 text-muted-foreground">No contract content yet. Build one from the Contracts list.</p>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
