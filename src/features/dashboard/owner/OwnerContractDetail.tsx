"use client";

import { useRouter } from "next/router";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, FileText, PenLine, User, Pencil } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CurrencySelect } from "@/components/ui/currency-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const [editOpen, setEditOpen] = useState(false);
  const [editMarkdown, setEditMarkdown] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editPayType, setEditPayType] = useState<"hourly" | "per_session">("hourly");
  const [editRateAmount, setEditRateAmount] = useState("");
  const [editRateCurrency, setEditRateCurrency] = useState("GBP");
  const [editSignedAt, setEditSignedAt] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);

  const openDetailsDialog = () => {
    if (!contract) return;
    setEditPayType((contract.pay_type as "hourly" | "per_session") || "hourly");
    setEditRateAmount(String(contract.rate_amount ?? ""));
    setEditRateCurrency(contract.rate_currency?.trim() || "GBP");
    setEditSignedAt(
      contract.contract_signed_at
        ? new Date(contract.contract_signed_at).toISOString().slice(0, 10)
        : ""
    );
    setDetailsOpen(true);
  };

  const handleSaveDetails = async () => {
    if (!contract?.id) return;
    setSavingDetails(true);
    try {
      const payload: {
        pay_type: "hourly" | "per_session";
        rate_amount: number;
        rate_currency: string;
        contract_signed_at: string | null;
      } = {
        pay_type: editPayType,
        rate_amount: parseFloat(editRateAmount) || 0,
        rate_currency: (editRateCurrency || "GBP").trim(),
        contract_signed_at: editSignedAt ? new Date(editSignedAt).toISOString() : null,
      };
      const { error } = await supabase
        .from("tutor_contracts")
        .update(payload)
        .eq("id", contract.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Rates and signed date updated");
      setDetailsOpen(false);
      invalidate();
    } finally {
      setSavingDetails(false);
    }
  };

  const CONTRACT_REVISION_SYSTEM = `You are a legal assistant. You will be given the current contract (Markdown) and a revision request.
Output the complete revised contract in the same Markdown format. Apply only the requested change; keep the rest unchanged in structure and tone.
Output only the full contract Markdown, no preamble or explanation.`;

  const handleRevise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contract || !revisePrompt.trim() || !contract.contract_body_text) return;
    setRevising(true);
    try {
      const prompt = `Current contract:\n\n${contract.contract_body_text}\n\nRevision request: ${revisePrompt.trim()}`;
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType: "contract_revision",
          prompt,
          systemInstruction: CONTRACT_REVISION_SYSTEM,
          model: "gpt-4o-mini",
        }),
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as { content?: string; error?: string };
      if (!res.ok) {
        toast.error(res.status === 402 ? (data.error ?? "Insufficient AI credits") : (data.error ?? "Failed to revise"));
        return;
      }
      const content = data.content?.trim();
      if (!content) {
        toast.error("AI did not return revised contract text");
        return;
      }
      const updateRes = await fetch("/api/contracts/update-body", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tutor_contract_id: contract.id,
          contract_body_text: content,
        }),
        credentials: "include",
      });
      const updateData = (await updateRes.json().catch(() => ({}))) as { error?: string };
      if (!updateRes.ok) {
        toast.error(updateData.error ?? "Failed to save revised contract");
        return;
      }
      toast.success("Contract revised");
      setRevisePrompt("");
      invalidate();
    } finally {
      setRevising(false);
    }
  };

  const handleExport = async () => {
    if (!contract) return;
    setExporting(true);
    try {
      const res = await fetch("/api/contracts/export-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tutor_contract_id: contract.id }),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((data as { error?: string }).error ?? "Failed to export document");
        return;
      }
      const url = (data as { url?: string }).url;
      if (url) window.open(url, "_blank");
      toast.success("Document exported");
      invalidate();
    } finally {
      setExporting(false);
    }
  };

  const openEditDialog = () => {
    if (contract?.contract_body_text) {
      setEditMarkdown(contract.contract_body_text);
      setEditOpen(true);
    }
  };

  const handleSaveEdit = async () => {
    if (!contract?.id) return;
    setSavingEdit(true);
    try {
      const res = await fetch("/api/contracts/update-body", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tutor_contract_id: contract.id,
          contract_body_text: editMarkdown,
        }),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((data as { error?: string }).error ?? "Failed to save");
        return;
      }
      toast.success("Contract updated");
      setEditOpen(false);
      invalidate();
    } finally {
      setSavingEdit(false);
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

  if (!contractId) {
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

  if (isLoading || !contract) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Button variant="ghost" asChild>
            <Link href="/dashboard/owner/contracts">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Contracts
            </Link>
          </Button>
          {isLoading ? (
            <div className="flex justify-center min-h-[200px] items-center">
              <Spinner size="lg" className="text-muted-foreground" />
            </div>
          ) : (
            <p className="text-muted-foreground">Contract not found.</p>
          )}
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

          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={openDetailsDialog}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit rates & signed date
            </Button>
          </div>

          {contract.contract_status === "change_requested" && (
            <div className="mt-4 p-3 rounded-lg bg-muted/50">
              <p className="text-sm font-medium">Tutor requested a change</p>
              <p className="text-sm text-muted-foreground mt-1">{contract.change_request_note || "No note."}</p>
              <Button variant="secondary" size="sm" className="mt-2" onClick={handleResetToPendingSignature} disabled={resettingStatus}>
                {resettingStatus ? <Spinner size="sm" /> : "Mark as updated (tutor can sign again)"}
              </Button>
            </div>
          )}

          {contract.contract_body_text && (
            <div className="flex flex-wrap gap-2 mt-4">
              {(contract.contract_status === "draft" ||
                contract.contract_status === "pending_signature" ||
                contract.contract_status === "change_requested") && (
                <Button variant="outline" size="sm" onClick={openEditDialog}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Manually edit
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
                {exporting ? <Spinner size="sm" /> : "Export"}
              </Button>
            </div>
          )}

          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Edit contract (Markdown)</DialogTitle>
                <DialogDescription>
                  Edit the contract content below. Use Markdown for headings, lists, and formatting.
                </DialogDescription>
              </DialogHeader>
              <Textarea
                value={editMarkdown}
                onChange={(e) => setEditMarkdown(e.target.value)}
                className="min-h-[400px] font-mono text-sm resize-y"
                placeholder="Contract content in Markdown..."
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditOpen(false)} disabled={savingEdit}>
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit} disabled={savingEdit}>
                  {savingEdit ? <Spinner size="sm" /> : "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Edit rates & signed date</DialogTitle>
                <DialogDescription>
                  Update pay rate and when the contract was signed. Changes apply to this contract record only.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-pay-type">Pay type</Label>
                    <Select value={editPayType} onValueChange={(v) => setEditPayType(v as "hourly" | "per_session")}>
                      <SelectTrigger id="edit-pay-type" className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hourly">Hourly</SelectItem>
                        <SelectItem value="per_session">Per session</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="edit-rate-amount">Rate amount</Label>
                    <Input
                      id="edit-rate-amount"
                      type="number"
                      min={0}
                      step={0.01}
                      value={editRateAmount}
                      onChange={(e) => setEditRateAmount(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="edit-rate-currency">Currency</Label>
                  <CurrencySelect
                    id="edit-rate-currency"
                    value={editRateCurrency}
                    onChange={setEditRateCurrency}
                    placeholder="Select currency"
                    className="mt-2 max-w-full"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-signed-at">Signed date (optional)</Label>
                  <Input
                    id="edit-signed-at"
                    type="date"
                    value={editSignedAt}
                    onChange={(e) => setEditSignedAt(e.target.value)}
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave empty if not signed yet. Set or change the date when the tutor signed.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailsOpen(false)} disabled={savingDetails}>
                  Cancel
                </Button>
                <Button onClick={handleSaveDetails} disabled={savingDetails}>
                  {savingDetails ? <Spinner size="sm" /> : "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

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
                  {revising ? <Spinner size="sm" /> : <PenLine className="h-4 w-4" />}
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
