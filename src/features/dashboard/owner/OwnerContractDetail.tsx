"use client";

import { useRouter } from "next/router";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AmountInput } from "@/components/ui/amount-input";
import { Label } from "@/components/ui/label";
import { parseAmountFromDisplay } from "@/lib/formatAmount";
import { ArrowLeft, PenLine, Pencil, DollarSign, Download, Send } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useState, useEffect, useRef } from "react";
import { visit, SKIP } from "unist-util-visit";
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
import { useWorkspaceCurrency } from "@/hooks/useWorkspaceCurrency";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PLACEHOLDER_SPLIT_RE = /(\[[A-Z][^\]\n]*\])/g;
const PLACEHOLDER_TEST_RE = /^\[[A-Z][^\]\n]*\]$/;

function rehypePlaceholders() {
  return (tree: any) => {
    visit(tree, "text", (node: any, index: number | undefined, parent: any) => {
      if (!parent || index === undefined) return;
      const parts = (node.value as string).split(PLACEHOLDER_SPLIT_RE);
      if (parts.length === 1) return;
      const newNodes = parts
        .filter((p: string) => p !== "")
        .map((part: string) =>
          PLACEHOLDER_TEST_RE.test(part)
            ? { type: "element", tagName: "pfill", properties: {}, children: [{ type: "text", value: part }] }
            : { type: "text", value: part }
        );
      parent.children.splice(index, 1, ...newNodes);
      return [SKIP, index + newNodes.length] as const;
    });
  };
}

function PlaceholderChip({ label, onFill }: { label: string; onFill: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const confirm = () => {
    if (value.trim()) onFill(value.trim());
    setEditing(false);
    setValue("");
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={confirm}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); confirm(); }
          if (e.key === "Escape") { setEditing(false); setValue(""); }
        }}
        className="inline-block border-b-2 border-amber-500 bg-amber-50 dark:bg-amber-950 text-amber-900 dark:text-amber-100 px-1 text-sm focus:outline-none min-w-[140px]"
        placeholder={label}
      />
    );
  }

  return (
    <mark
      onClick={() => setEditing(true)}
      className="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 rounded px-1 py-0.5 cursor-pointer hover:bg-amber-200 dark:hover:bg-amber-800/50 transition-colors font-normal not-italic border border-amber-300 dark:border-amber-700"
      title="Click to fill this placeholder"
    >
      {`[${label}]`}
    </mark>
  );
}

const contractStatusLabel: Record<string, string> = {
  draft: "Draft",
  pending_signature: "Pending signature",
  signed: "Active agreement",
  change_requested: "Change requested",
};

export default function OwnerContractDetail() {
  const router = useRouter();
  const contractId = typeof router.query.id === "string" ? router.query.id : null;
  const { tutors, tutorContracts, invalidate, isLoading } = useOwnerWorkspace();
  const workspaceCurrency = useWorkspaceCurrency();
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
  const [editPayType, setEditPayType] = useState<"hourly" | "per_session" | "fixed_monthly">("hourly");
  const [editRateAmount, setEditRateAmount] = useState("");
  const [editSignedAt, setEditSignedAt] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);

  const [ownerSignatureName, setOwnerSignatureName] = useState("");
  const [ownerSigning, setOwnerSigning] = useState(false);

  const [localBody, setLocalBody] = useState(contract?.contract_body_text ?? "");
  const [savingPlaceholders, setSavingPlaceholders] = useState(false);
  const localBodyDirty = localBody !== (contract?.contract_body_text ?? "");

  useEffect(() => {
    setLocalBody(contract?.contract_body_text ?? "");
  }, [contract?.contract_body_text]);

  const handleSavePlaceholders = async () => {
    if (!contract?.id) return;
    setSavingPlaceholders(true);
    try {
      const res = await fetch("/api/contracts/update-body", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tutor_contract_id: contract.id, contract_body_text: localBody }),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error((data as { error?: string }).error ?? "Failed to save"); return; }
      toast.success("Contract saved");
      invalidate();
    } finally {
      setSavingPlaceholders(false);
    }
  };

  useEffect(() => {
    if (!isLoading && contract && !contract.contract_body_text) {
      router.replace(`/dashboard/owner/contracts/new?tutorId=${contract.tutor_id}`);
    }
  }, [isLoading, contract, router]);

  const openDetailsDialog = () => {
    if (!contract) return;
    const ct = (contract as { contract_type?: string }).contract_type ?? contract.pay_type;
    setEditPayType((ct === "per_session" ? "per_session" : ct === "fixed_monthly" ? "fixed_monthly" : "hourly") as "hourly" | "per_session" | "fixed_monthly");
    setEditRateAmount(String(contract.rate_amount ?? ""));
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
        pay_type: "hourly" | "per_session" | "fixed_monthly";
        contract_type: "hourly" | "per_session" | "fixed_monthly";
        rate_amount: number;
        rate_currency: string;
        contract_signed_at: string | null;
      } = {
        pay_type: editPayType,
        contract_type: editPayType,
        rate_amount: parseAmountFromDisplay(editRateAmount),
        rate_currency: workspaceCurrency.trim(),
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
Do not include a main document title/heading at the top—the app shows it as a static header. Do not include any signature section, signature blocks, or signature footer—signatures are displayed separately by the app. End the contract after the last substantive clause (e.g. Notices).
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

  const handleOwnerSign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contract?.id || !ownerSignatureName.trim()) return;
    setOwnerSigning(true);
    try {
      const res = await fetch("/api/contracts/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tutor_contract_id: contract.id,
          signature_name: ownerSignatureName.trim(),
          signer: "owner",
        }),
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Failed to sign");
        return;
      }
      toast.success("Signed as owner");
      setOwnerSignatureName("");
      invalidate();
    } finally {
      setOwnerSigning(false);
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

  const statusLabel = contractStatusLabel[contract.contract_status] ?? contract.contract_status;
  const lastUpdated = contract.updated_at
    ? new Date(contract.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;
  const initials = tutorName
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        {/* Top bar: Back (left), Status + avatar (right) */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/owner/contracts" className="inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Contracts
            </Link>
          </Button>
          <div className="flex items-center justify-end gap-3">
            <span className="text-sm text-muted-foreground">Status:</span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium text-muted-foreground
                ${
                  contract.contract_status === "signed"
                    ? "text-green-700 bg-green-100"
                    : contract.contract_status === "pending_signature"
                    ? "text-yellow-800 bg-yellow-100"
                    : contract.contract_status === "change_requested"
                    ? "text-red-700 bg-red-100"
                    : "text-muted-foreground bg-muted"
                }
              `}
              aria-label={`Contract status: ${statusLabel}`}
            >
              {statusLabel}
            </span>
          </div>
        </header>

        {/* Single document card */}
        <article className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          {/* Document header */}
          <div className="border-b border-border px-6 py-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-foreground">
                  Tutoring Services Agreement
                </h1>
                {lastUpdated && (
                  <p className="mt-1 text-sm text-muted-foreground flex items-center gap-1.5">
                    <span>Last updated: {lastUpdated}</span>
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={openDetailsDialog} className="gap-1.5">
                  <DollarSign className="h-4 w-4" />
                  Rates
                </Button>
                {(contract.contract_status === "draft" ||
                  contract.contract_status === "pending_signature" ||
                  contract.contract_status === "change_requested") &&
                  contract.contract_body_text && (
                  <Button variant="outline" size="sm" onClick={openEditDialog} className="gap-1.5">
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting} className="gap-1.5">
                  {exporting ? <Spinner size="sm" /> : <Download className="h-4 w-4" />}
                  Export
                </Button>
              </div>
            </div>
          </div>

          {/* Change requested alert (like reference cancellation policy box) */}
          {contract.contract_status === "change_requested" && (
            <div className="mx-6 mt-4 rounded-lg border border-border bg-muted/50 p-4">
              <p className="text-sm font-medium text-foreground">Tutor requested a change</p>
              <p className="text-sm text-muted-foreground mt-1">{contract.change_request_note || "No note."}</p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={handleResetToPendingSignature}
                disabled={resettingStatus}
              >
                {resettingStatus ? <Spinner size="sm" /> : "Mark as updated (tutor can sign again)"}
              </Button>
            </div>
          )}

          {/* Main agreement content */}
          <div className="px-6 py-6">
            {contract.contract_body_text ? (
              <>
                {localBodyDirty && (
                  <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-2.5">
                    <p className="text-sm text-amber-800 dark:text-amber-200">Unsaved placeholder changes</p>
                    <Button size="sm" onClick={handleSavePlaceholders} disabled={savingPlaceholders}>
                      {savingPlaceholders ? <Spinner size="sm" /> : "Save changes"}
                    </Button>
                  </div>
                )}
                <div className="prose prose-sm dark:prose-invert max-w-none text-foreground [&_h2]:font-semibold [&_h2]:text-foreground [&_p]:text-muted-foreground [&_p]:leading-relaxed">
                  <ReactMarkdown
                    rehypePlugins={[rehypePlaceholders]}
                    components={{
                      pfill: ({ children }: any) => {
                        const text = String(children);
                        const label = text.slice(1, -1);
                        return (
                          <PlaceholderChip
                            label={label}
                            onFill={(v) =>
                              setLocalBody((prev) =>
                                prev.replace(new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), v)
                              )
                            }
                          />
                        );
                      },
                    } as any}
                  >
                    {localBody}
                  </ReactMarkdown>
                </div>
              </>
            ) : (
              <div className="flex justify-center min-h-[120px] items-center">
                <Spinner size="lg" className="text-muted-foreground" />
              </div>
            )}

            {/* Signature block */}
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-8 pt-8 border-t border-border">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Tutor signature</p>
                <p className="font-medium text-foreground border-b border-border pb-1">
                  {contract.tutor_signature_name ?? "—"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Date: {contract.contract_signed_at ? new Date(contract.contract_signed_at).toLocaleDateString() : "Pending"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Workspace / Business Representative</p>
                {contract.owner_signature_name ? (
                  <>
                    <p className="font-medium text-foreground border-b border-border pb-1">
                      {contract.owner_signature_name}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Date: {contract.owner_signed_at ? new Date(contract.owner_signed_at).toLocaleDateString() : "Pending"}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-muted-foreground border-b border-border pb-1">
                      Awaiting digital signature…
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">Date: Pending</p>
                    <form onSubmit={handleOwnerSign} className="mt-3 flex flex-wrap items-end gap-2">
                      <div className="flex-1 min-w-[160px]">
                        <Label htmlFor="owner-signature-name" className="sr-only">Your full name</Label>
                        <Input
                          id="owner-signature-name"
                          value={ownerSignatureName}
                          onChange={(e) => setOwnerSignatureName(e.target.value)}
                          placeholder="Your full name"
                          className="h-9"
                        />
                      </div>
                      <Button type="submit" size="sm" disabled={ownerSigning || !ownerSignatureName.trim()}>
                        {ownerSigning ? <Spinner size="sm" /> : "Sign Contract"}
                      </Button>
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>
        </article>

        {/* Revise by prompt (when editable) */}
        {(contract.contract_status === "draft" ||
          contract.contract_status === "pending_signature" ||
          contract.contract_status === "change_requested") &&
          contract.contract_body_text && (
          <form onSubmit={handleRevise} className="rounded-xl border border-border bg-card p-4 space-y-2">
            <Label htmlFor="revise-prompt">Edit contract by prompt</Label>
            <div className="flex gap-2">
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

        {/* Footer actions
        <div className="flex flex-wrap items-center justify-center gap-3">
          {(contract.contract_status === "pending_signature" || contract.contract_status === "change_requested") && (
            <Button asChild>
              <Link href={`/dashboard/owner/tutors/${contract.tutor_id}`} className="gap-2">
                <Send className="h-4 w-4" />
                Request signature
              </Link>
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href="/dashboard/owner/contracts">Close view</Link>
          </Button>
        </div> */}
      </div>

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
                <Select value={editPayType} onValueChange={(v) => setEditPayType(v as "hourly" | "per_session" | "fixed_monthly")}>
                  <SelectTrigger id="edit-pay-type" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="per_session">Per session</SelectItem>
                    <SelectItem value="fixed_monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-rate-amount">Rate amount</Label>
                <AmountInput
                  id="edit-rate-amount"
                  value={editRateAmount}
                  onChange={setEditRateAmount}
                  className="mt-2"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-rate-currency">Currency</Label>
              <Input
                id="edit-rate-currency"
                value={workspaceCurrency}
                readOnly
                disabled
                className="mt-2 bg-muted"
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
    </DashboardLayout>
  );
}
