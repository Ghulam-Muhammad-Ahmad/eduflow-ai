"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Check, ExternalLink } from "lucide-react";
import { useWorkspaceCurrency } from "@/hooks/useWorkspaceCurrency";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";

type InvoiceRow = {
  id: string;
  description: string | null;
  amount: number;
  currency: string;
  due_date: string;
  status: string;
  proof_storage_path: string | null;
};

function formatCurrency(amount: number, currency: string, fallback: string): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: (currency || fallback).trim() || "GBP",
    minimumFractionDigits: 2,
  }).format(amount);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.includes(",") ? result.split(",")[1]! : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function OwnerStudentBilling() {
  const router = useRouter();
  const { id: studentId } = router.query;
  const queryClient = useQueryClient();
  const workspaceCurrency = useWorkspaceCurrency();
  const [statusTab, setStatusTab] = useState<string>("all");
  const [actionModal, setActionModal] = useState<{
    invoice: InvoiceRow;
    action: "mark_paid" | "waive" | "confirm_paid" | "reject";
  } | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [waiveReason, setWaiveReason] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { assignedStudents } = useOwnerWorkspace();
  const student = (assignedStudents as { student_id: string; student?: { display_name?: string; email?: string } }[]).find(
    (s) => s.student_id === studentId
  );
  const displayName = student?.student?.display_name || student?.student?.email || "Student";

  const { data: invoicesData, isLoading } = useQuery({
    queryKey: ["owner-students-invoices", studentId],
    queryFn: async () => {
      const res = await fetch(`/api/owner/students/${studentId}/invoices`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load invoices");
      return res.json() as Promise<{ invoices: InvoiceRow[] }>;
    },
    enabled: !!studentId,
  });

  const patchMutation = useMutation({
    mutationFn: async (payload: {
      invoice_id: string;
      action: string;
      proof_base64?: string;
      proof_mime?: string;
      waived_reason?: string;
    }) => {
      const res = await fetch(`/api/owner/students/${studentId}/invoices`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Action failed");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-students-invoices", studentId] });
      queryClient.invalidateQueries({ queryKey: ["owner-finance-summary"] });
      setActionModal(null);
      setProofFile(null);
      setWaiveReason("");
      toast.success("Updated.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const invoices = (invoicesData?.invoices ?? []) as InvoiceRow[];
  const filtered =
    statusTab === "all"
      ? invoices
      : invoices.filter((i) => i.status === statusTab);

  const tabs = [
    { value: "all", label: "All" },
    { value: "unpaid", label: "Unpaid" },
    { value: "proof_submitted", label: "Proof submitted" },
    { value: "paid", label: "Paid" },
    { value: "waived", label: "Waived" },
  ];

  const handleViewProof = async (invoiceId: string) => {
    try {
      const res = await fetch(
        `/api/payment-proofs/url?entity=invoice&id=${encodeURIComponent(invoiceId)}`,
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

  const handleConfirmAction = async () => {
    if (!actionModal) return;
    const { invoice, action } = actionModal;
    let proofBase64: string | undefined;
    let proofMime: string | undefined;
    if (proofFile && (action === "mark_paid" || action === "confirm_paid")) {
      proofBase64 = await fileToBase64(proofFile);
      proofMime = proofFile.type;
    }
    patchMutation.mutate({
      invoice_id: invoice.id,
      action,
      proof_base64: proofBase64,
      proof_mime: proofMime,
      waived_reason: action === "waive" ? waiveReason : undefined,
    });
  };

  if (!studentId && !router.isReady) return null;
  if (!student) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Button variant="ghost" asChild>
            <Link href="/dashboard/owner/students">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Students
            </Link>
          </Button>
          <p className="text-muted-foreground">Student not found.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-in fade-in duration-300">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/dashboard/owner/students/${studentId}`} aria-label="Back to student">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
                Billing: {displayName}
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Manage invoices, track payments, and verify proof for this student.
              </p>
            </div>
          </div>
          <Button size="sm" className="bg-primary shrink-0" asChild>
            <Link href={`/dashboard/owner/students/${studentId}/billing-setup`}>
              Fee setup
            </Link>
          </Button>
        </div>

        <div className="border-b border-border">
          <nav className="flex gap-4 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setStatusTab(t.value)}
                className={`pb-3 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                  statusTab === t.value
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        <Card className="border-border">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                No invoices in this category.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">Description</th>
                      <th className="text-left font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">Due date</th>
                      <th className="text-right font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">Amount</th>
                      <th className="text-left font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">Status</th>
                      <th className="text-right font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((inv) => (
                      <tr key={inv.id} className="border-b border-border/60 hover:bg-muted/20">
                        <td className="py-3 px-4 font-medium">{inv.description || "—"}</td>
                        <td className="py-3 px-4 text-muted-foreground">{inv.due_date}</td>
                        <td className="py-3 px-4 text-right tabular-nums">
                          {formatCurrency(inv.amount, inv.currency, workspaceCurrency)}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={
                              inv.status === "paid"
                                ? "success"
                                : inv.status === "proof_submitted"
                                  ? "default"
                                  : inv.status === "waived"
                                    ? "secondary"
                                    : "destructive"
                            }
                            className="capitalize"
                          >
                            {inv.status.replace("_", " ")}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {inv.status === "proof_submitted" && (
                            <>
                              <Button
                                variant="link"
                                size="sm"
                                className="text-primary p-0 h-auto mr-2"
                                onClick={() => setActionModal({ invoice: inv, action: "confirm_paid" })}
                              >
                                Confirm paid
                              </Button>
                              <Button
                                variant="link"
                                size="sm"
                                className="text-primary p-0 h-auto mr-2"
                                onClick={() => setActionModal({ invoice: inv, action: "mark_paid" })}
                              >
                                Replace proof & mark paid
                              </Button>
                              <Button
                                variant="link"
                                size="sm"
                                className="text-destructive p-0 h-auto"
                                onClick={() => setActionModal({ invoice: inv, action: "reject" })}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                          {inv.status === "unpaid" && (
                            <>
                              <Button
                                variant="link"
                                size="sm"
                                className="text-primary p-0 h-auto mr-2"
                                onClick={() => setActionModal({ invoice: inv, action: "mark_paid" })}
                              >
                                Mark paid
                              </Button>
                              <Button
                                variant="link"
                                size="sm"
                                className="text-muted-foreground p-0 h-auto"
                                onClick={() => setActionModal({ invoice: inv, action: "waive" })}
                              >
                                Waive
                              </Button>
                            </>
                          )}
                          {inv.status === "paid" && inv.proof_storage_path && (
                            <Button
                              variant="link"
                              size="sm"
                              className="text-primary p-0 h-auto gap-1"
                              onClick={() => handleViewProof(inv.id)}
                            >
                              View receipt
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
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
      </div>

      {actionModal && (
        <Dialog open={!!actionModal} onOpenChange={() => setActionModal(null)}>
          <DialogContent className="max-w-md rounded-xl">
            <DialogHeader>
              <DialogTitle>
                {actionModal.action === "confirm_paid" && "Confirm paid"}
                {actionModal.action === "reject" && "Reject proof"}
                {actionModal.action === "mark_paid" && "Mark as paid"}
                {actionModal.action === "waive" && "Waive invoice"}
              </DialogTitle>
            </DialogHeader>
            <div className="py-2">
              {actionModal.action === "waive" && (
                <div>
                  <label className="text-sm font-medium">Reason (optional)</label>
                  <input
                    type="text"
                    value={waiveReason}
                    onChange={(e) => setWaiveReason(e.target.value)}
                    placeholder="e.g. Scholarship"
                    className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                  />
                </div>
              )}
              {(actionModal.action === "mark_paid" || actionModal.action === "confirm_paid") && (
                <div>
                  <label className="text-sm font-medium">Upload proof (optional)</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 w-full rounded-lg border-2 border-dashed border-border py-4 text-sm text-muted-foreground hover:bg-muted/30"
                  >
                    {proofFile ? proofFile.name : "Click to upload receipt"}
                  </button>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setActionModal(null)}>
                Cancel
              </Button>
              <Button
                className="bg-primary"
                onClick={handleConfirmAction}
                disabled={patchMutation.isPending}
              >
                {patchMutation.isPending ? <Spinner size="sm" /> : <Check className="h-4 w-4" />}
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}
