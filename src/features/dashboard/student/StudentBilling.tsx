"use client";

import { useState, useRef } from "react";
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
import { AlertTriangle, Upload, ExternalLink } from "lucide-react";
import { useWorkspaceCurrency } from "@/hooks/useWorkspaceCurrency";

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

export default function StudentBilling() {
  const queryClient = useQueryClient();
  const workspaceCurrency = useWorkspaceCurrency();
  const [submitModalInvoice, setSubmitModalInvoice] = useState<InvoiceRow | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: invoicesData, isLoading } = useQuery({
    queryKey: ["student-invoices"],
    queryFn: async () => {
      const res = await fetch("/api/student/invoices", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load invoices");
      return res.json() as Promise<{ invoices: InvoiceRow[] }>;
    },
  });

  const submitProofMutation = useMutation({
    mutationFn: async ({ invoiceId, proofBase64, proofMime }: { invoiceId: string; proofBase64: string; proofMime: string }) => {
      const res = await fetch(`/api/student/invoices/${invoiceId}/submit-proof`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ proof_base64: proofBase64, proof_mime: proofMime }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Submit failed");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-invoices"] });
      setSubmitModalInvoice(null);
      setProofFile(null);
      toast.success("Proof submitted. The owner will review it.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const invoices = (invoicesData?.invoices ?? []) as InvoiceRow[];
  const outstandingTotal = invoices
    .filter((i) => i.status === "unpaid" || i.status === "proof_submitted")
    .reduce((s, i) => s + Number(i.amount), 0);
  const primaryCurrency = invoices[0]?.currency ?? workspaceCurrency;
  const hasOutstanding = outstandingTotal > 0;

  const handleSubmitProof = async () => {
    if (!submitModalInvoice || !proofFile) {
      toast.error("Please select a file");
      return;
    }
    const proofBase64 = await fileToBase64(proofFile);
    const proofMime = proofFile.type;
    submitProofMutation.mutate({
      invoiceId: submitModalInvoice.id,
      proofBase64,
      proofMime,
    });
  };

  const handleViewReceipt = async (invoiceId: string) => {
    try {
      const res = await fetch(
        `/api/payment-proofs/url?entity=invoice&id=${encodeURIComponent(invoiceId)}`,
        { credentials: "include" }
      );
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        toast.error(data.error ?? "Could not load receipt");
        return;
      }
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Failed to load receipt");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-in fade-in duration-300">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
            My Billing
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage your tuition fees, view payment history, and submit proofs.
          </p>
        </div>

        {hasOutstanding && (
          <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                <AlertTriangle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  Outstanding balance: {formatCurrency(outstandingTotal, primaryCurrency, workspaceCurrency)}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  You have unpaid invoice(s). To avoid service interruption, complete payment or submit proof of transfer.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              className="bg-primary text-primary-foreground shrink-0"
              onClick={() => {
                const firstUnpaid = invoices.find((i) => i.status === "unpaid");
                if (firstUnpaid) setSubmitModalInvoice(firstUnpaid);
              }}
            >
              Pay now
            </Button>
          </div>
        )}

        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Invoice history</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                View status and submit proof of payment for unpaid items.
              </p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : invoices.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                No invoices yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">Description</th>
                      <th className="text-right font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">Amount</th>
                      <th className="text-left font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">Due date</th>
                      <th className="text-left font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">Status</th>
                      <th className="text-right font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="border-b border-border/60 hover:bg-muted/20">
                        <td className="py-3 px-4 font-medium">{inv.description || "—"}</td>
                        <td className="py-3 px-4 text-right tabular-nums">
                          {formatCurrency(inv.amount, inv.currency, workspaceCurrency)}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">{inv.due_date}</td>
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
                          {inv.status === "unpaid" && (
                            <Button
                              variant="link"
                              size="sm"
                              className="text-primary p-0 h-auto gap-1"
                              onClick={() => setSubmitModalInvoice(inv)}
                            >
                              <Upload className="h-3.5 w-3.5" />
                              I&apos;ve paid – submit proof
                            </Button>
                          )}
                          {inv.status === "proof_submitted" && (
                            <span className="text-muted-foreground text-xs">Pending verification</span>
                          )}
                          {inv.status === "paid" && inv.proof_storage_path && (
                            <Button
                              variant="link"
                              size="sm"
                              className="text-primary p-0 h-auto gap-1"
                              onClick={() => handleViewReceipt(inv.id)}
                            >
                              View receipt
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {inv.status === "waived" && (
                            <span className="text-muted-foreground text-xs">—</span>
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

      {submitModalInvoice && (
        <Dialog open={!!submitModalInvoice} onOpenChange={() => setSubmitModalInvoice(null)}>
          <DialogContent className="max-w-md rounded-xl">
            <DialogHeader>
              <DialogTitle>Submit proof of payment</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {submitModalInvoice.description || "Invoice"} — {formatCurrency(submitModalInvoice.amount, submitModalInvoice.currency, workspaceCurrency)}
            </p>
            <div>
              <label className="text-sm font-medium">Upload receipt or proof</label>
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
                className="mt-2 w-full rounded-lg border-2 border-dashed border-border py-6 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:bg-muted/30 hover:text-foreground"
              >
                <Upload className="h-8 w-8" />
                {proofFile ? proofFile.name : "Click or drag to upload"}
                <span className="text-xs">PDF, JPG or PNG (max 10MB)</span>
              </button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSubmitModalInvoice(null)}>
                Cancel
              </Button>
              <Button
                className="bg-primary"
                onClick={handleSubmitProof}
                disabled={!proofFile || submitProofMutation.isPending}
              >
                {submitProofMutation.isPending ? <Spinner size="sm" /> : null}
                Submit proof
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}
