"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTutorContract } from "@/hooks/useTutorContract";
import { ArrowLeft, FileText, Check, Loader2, Download, Send } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function TeacherContract() {
  const { contract, isLoading, refetch } = useTutorContract();
  const [signatureName, setSignatureName] = useState("");
  const [changeNote, setChangeNote] = useState("");
  const [signing, setSigning] = useState(false);
  const [requestingChange, setRequestingChange] = useState(false);

  const handleSign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contract || !signatureName.trim()) return;
    setSigning(true);
    try {
      const res = await fetch("/api/contracts/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tutor_contract_id: contract.id,
          signature_name: signatureName.trim(),
        }),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed to sign");
        return;
      }
      toast.success("Contract signed");
      setSignatureName("");
      void refetch();
    } finally {
      setSigning(false);
    }
  };

  const handleRequestChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contract) return;
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
        toast.error(data.error ?? "Failed to submit request");
        return;
      }
      toast.success("Change request sent to owner");
      setChangeNote("");
      void refetch();
    } finally {
      setRequestingChange(false);
    }
  };

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
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/teacher">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>

        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="h-8 w-8 text-primary" />
            <h1 className="text-xl font-bold">Your contract</h1>
          </div>

          {!contract ? (
            <p className="text-muted-foreground">No contract record found for your workspace.</p>
          ) : (
            <>
              {contract.contract_status === "draft" && !contract.contract_body_text && (
                <p className="text-muted-foreground">
                  The owner has not created the contract yet. They will build it from the Contracts tab and send it to you when ready.
                </p>
              )}

              {contract.contract_body_text && (
                <>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {contract.contract_storage_path && (
                      <Button variant="outline" size="sm" onClick={handleDownload}>
                        <Download className="mr-2 h-4 w-4" />
                        Download PDF
                      </Button>
                    )}
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-4 max-h-[500px] overflow-y-auto mb-6 prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{contract.contract_body_text}</ReactMarkdown>
                  </div>

                  {contract.contract_status === "pending_signature" && (
                    <div className="space-y-4">
                      <h2 className="font-semibold">Sign the contract</h2>
                      <form onSubmit={handleSign} className="flex flex-wrap items-end gap-4">
                        <div className="flex-1 min-w-[200px]">
                          <Label htmlFor="signature_name">Full legal name</Label>
                          <Input
                            id="signature_name"
                            value={signatureName}
                            onChange={(e) => setSignatureName(e.target.value)}
                            placeholder="Jane Doe"
                            required
                            className="mt-2"
                          />
                        </div>
                        <Button type="submit" disabled={signing}>
                          {signing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Check className="mr-2 h-4 w-4" />
                              Sign contract
                            </>
                          )}
                        </Button>
                      </form>
                      <h2 className="font-semibold pt-4">Or request a change</h2>
                      <form onSubmit={handleRequestChange} className="space-y-2">
                        <Label htmlFor="change_note">Note to owner (optional)</Label>
                        <Textarea
                          id="change_note"
                          value={changeNote}
                          onChange={(e) => setChangeNote(e.target.value)}
                          placeholder="Describe what you would like changed..."
                          rows={3}
                          className="mt-2"
                        />
                        <Button type="submit" variant="secondary" disabled={requestingChange}>
                          {requestingChange ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Send className="mr-2 h-4 w-4" />
                              Request change
                            </>
                          )}
                        </Button>
                      </form>
                    </div>
                  )}

                  {contract.contract_status === "change_requested" && (
                    <p className="text-muted-foreground">
                      You have requested changes. The owner will review and may update the contract; you will then be
                      able to sign again.
                    </p>
                  )}

                  {contract.contract_status === "signed" && (
                    <p className="text-muted-foreground">
                      Signed on{" "}
                      {contract.contract_signed_at
                        ? new Date(contract.contract_signed_at).toLocaleDateString()
                        : "—"}{" "}
                      by {contract.tutor_signature_name ?? "—"}.
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
