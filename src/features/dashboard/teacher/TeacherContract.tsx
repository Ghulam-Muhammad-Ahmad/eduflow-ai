"use client";

import ReactMarkdown from "react-markdown";
import { useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTutorContract } from "@/hooks/useTutorContract";
import { ArrowLeft, FileText, Download, PenLine } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";
import { toast } from "sonner";

const contractStatusLabel: Record<string, string> = {
  draft: "Draft",
  pending_signature: "Pending your signature",
  signed: "Active agreement",
  change_requested: "Change requested",
};

type ContractWithStatus = ReturnType<typeof useTutorContract>["contract"] & {
  contract_type?: string;
  start_date?: string;
  end_date?: string | null;
  status?: string;
};

export default function TeacherContract() {
  const { contract, isLoading, refetch } = useTutorContract();
  const c = contract as ContractWithStatus | null;

  const [signatureName, setSignatureName] = useState("");
  const [signing, setSigning] = useState(false);
  const [requestChangeOpen, setRequestChangeOpen] = useState(false);
  const [changeNote, setChangeNote] = useState("");
  const [requestingChange, setRequestingChange] = useState(false);

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

  const handleSign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contract?.id || !signatureName.trim()) return;
    setSigning(true);
    try {
      const res = await fetch("/api/contracts/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tutor_contract_id: contract.id,
          signature_name: signatureName.trim(),
          signer: "tutor",
        }),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((data as { error?: string }).error ?? "Failed to sign");
        return;
      }
      toast.success("Contract signed successfully");
      setSignatureName("");
      refetch();
    } finally {
      setSigning(false);
    }
  };

  const handleRequestChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contract?.id) return;
    setRequestingChange(true);
    try {
      const res = await fetch("/api/contracts/request-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tutor_contract_id: contract.id,
          note: changeNote.trim() || undefined,
        }),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((data as { error?: string }).error ?? "Failed to request change");
        return;
      }
      toast.success("Change request sent. The owner will review and may send an updated contract.");
      setRequestChangeOpen(false);
      setChangeNote("");
      refetch();
    } finally {
      setRequestingChange(false);
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
  const statusRaw = c?.contract_status ?? c?.status ?? "—";
  const status = typeof statusRaw === "string" && contractStatusLabel[statusRaw] ? contractStatusLabel[statusRaw] : String(statusRaw).replace(/_/g, " ");
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
                  <dd className="mt-0.5 font-medium">{status}</dd>
                </div>
              </dl>

              {c.contract_status === "pending_signature" && (
                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    The workspace owner has sent this contract for your signature. Enter your full legal name below to sign.
                  </p>
                  <form onSubmit={handleSign} className="flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[200px] space-y-2">
                      <Label htmlFor="signature-name">Full name (as on contract)</Label>
                      <Input
                        id="signature-name"
                        value={signatureName}
                        onChange={(e) => setSignatureName(e.target.value)}
                        placeholder="Your full name"
                        required
                        disabled={signing}
                        className="max-w-sm"
                      />
                    </div>
                    <Button type="submit" disabled={signing || !signatureName.trim()}>
                      {signing ? "Signing…" : "Sign contract"}
                    </Button>
                  </form>
                </div>
              )}

              {c.contract_status !== "signed" && c.contract_body_text && (
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setRequestChangeOpen(true)}
                    className="gap-2"
                  >
                    <PenLine className="h-4 w-4" />
                    Request changes
                  </Button>
                </div>
              )}

              {c.contract_status === "signed" && c.contract_signed_at && (
                <p className="text-sm text-muted-foreground">
                  Signed on {new Date(c.contract_signed_at).toLocaleDateString()}
                  {c.tutor_signature_name ? ` by ${c.tutor_signature_name}` : ""}.
                </p>
              )}

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

      <Dialog open={requestChangeOpen} onOpenChange={setRequestChangeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request changes</DialogTitle>
            <DialogDescription>
              Send a change request to the workspace owner. They can revise the contract and send it back for your signature.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRequestChange}>
            <div className="space-y-2 py-2">
              <Label htmlFor="change-note">Note (optional)</Label>
              <Textarea
                id="change-note"
                value={changeNote}
                onChange={(e) => setChangeNote(e.target.value)}
                placeholder="Describe what you’d like changed…"
                rows={4}
                disabled={requestingChange}
                className="resize-none"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRequestChangeOpen(false)} disabled={requestingChange}>
                Cancel
              </Button>
              <Button type="submit" disabled={requestingChange}>
                {requestingChange ? "Sending…" : "Send request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
