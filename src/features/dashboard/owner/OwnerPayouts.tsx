"use client";

import { useMemo, useState, useRef } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogFooter,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Wallet,
  Upload,
  ExternalLink,
  CheckCircle2,
  History,
} from "lucide-react";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useWorkspaceCurrency } from "@/hooks/useWorkspaceCurrency";

type EarningRow = {
  id: string;
  tutor_id: string;
  period_date: string;
  description: string | null;
  net_amount: number;
  currency: string;
  status: string;
  earning_type: string;
};

type PayoutRow = {
  id: string;
  tutor_id: string;
  total_net_amount: number;
  currency: string;
  payment_note: string | null;
  proof_storage_path: string | null;
  status: string;
  paid_at: string | null;
  created_at: string;
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
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64 ?? "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function OwnerPayouts() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [selectedTutorId, setSelectedTutorId] = useState<string | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [note, setNote] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { tutors } = useOwnerWorkspace();
  const workspaceCurrency = useWorkspaceCurrency();
  const tutorMap = useMemo(() => new Map(tutors.map((t) => [t.user_id, t])), [tutors]);

  const { data: earningData, isLoading: earningLoading } = useQuery({
    queryKey: ["owner-earning-rows"],
    queryFn: async () => {
      const res = await fetch("/api/owner/earning-rows", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load earning rows");
      return res.json() as Promise<{ rows: EarningRow[] }>;
    },
  });

  const { data: payoutsData, isLoading: payoutsLoading } = useQuery({
    queryKey: ["owner-payouts"],
    queryFn: async () => {
      const res = await fetch("/api/owner/payouts", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load payouts");
      return res.json() as Promise<{ payouts: PayoutRow[] }>;
    },
  });

  const pendingRows = useMemo(() => {
    const rows = (earningData?.rows ?? []) as EarningRow[];
    return rows.filter((r) => r.status === "pending" || r.status === "approved");
  }, [earningData]);

  const byTutor = useMemo(() => {
    const map = new Map<string, EarningRow[]>();
    for (const row of pendingRows) {
      const list = map.get(row.tutor_id) ?? [];
      list.push(row);
      map.set(row.tutor_id, list);
    }
    return map;
  }, [pendingRows]);

  const payouts = (payoutsData?.payouts ?? []) as PayoutRow[];

  const createPayoutMutation = useMutation({
    mutationFn: async (payload: {
      earning_row_ids: string[];
      tutor_id: string;
      payment_note?: string;
      proof_base64?: string;
      proof_mime?: string;
    }) => {
      const res = await fetch("/api/owner/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to create payout");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-payouts"] });
      queryClient.invalidateQueries({ queryKey: ["owner-earning-rows"] });
      queryClient.invalidateQueries({ queryKey: ["owner-finance-summary"] });
      setModalOpen(false);
      setSelectedTutorId(null);
      setSelectedRowIds(new Set());
      setNote("");
      setProofFile(null);
      toast.success("Payout created successfully.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openCreateModal = (tutorId: string, rowIds: string[]) => {
    setSelectedTutorId(tutorId);
    setSelectedRowIds(new Set(rowIds));
    setNote("");
    setProofFile(null);
    setModalOpen(true);
  };

  const handleConfirmPayout = async () => {
    if (!selectedTutorId || selectedRowIds.size === 0) return;
    let proofBase64: string | undefined;
    let proofMime: string | undefined;
    if (proofFile) {
      proofBase64 = await fileToBase64(proofFile);
      proofMime = proofFile.type;
    }
    createPayoutMutation.mutate({
      earning_row_ids: Array.from(selectedRowIds),
      tutor_id: selectedTutorId,
      payment_note: note.trim() || undefined,
      proof_base64: proofBase64,
      proof_mime: proofMime,
    });
  };

  const selectedTotal = useMemo(() => {
    if (!selectedTutorId) return { total: 0, currency: workspaceCurrency };
    let total = 0;
    let currency = workspaceCurrency;
    for (const id of selectedRowIds) {
      const row = pendingRows.find((r) => r.id === id);
      if (row) {
        total += Number(row.net_amount);
        currency = row.currency;
      }
    }
    return { total, currency };
  }, [selectedTutorId, selectedRowIds, pendingRows, workspaceCurrency]);

  const tutorName = selectedTutorId ? tutorMap.get(selectedTutorId)?.profile?.display_name || tutorMap.get(selectedTutorId)?.profile?.email || "Tutor" : "";

  const handleViewProof = async (payoutId: string) => {
    try {
      const res = await fetch(
        `/api/payment-proofs/url?entity=payout&id=${encodeURIComponent(payoutId)}`,
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

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-in fade-in duration-300">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/owner/finance" aria-label="Back to Finance">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
              Payout Management
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Process tutor payouts and view payout history.
            </p>
          </div>
        </div>

        <div className="border-b border-border">
          <nav className="flex gap-6">
            <button
              type="button"
              onClick={() => setActiveTab("pending")}
              className={`pb-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === "pending"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Pending earnings
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={`pb-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === "history"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Payout history
            </button>
          </nav>
        </div>

        {activeTab === "pending" && (
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                Pending earnings by tutor
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Select a tutor and create a payout to mark selected rows as paid.
              </p>
            </CardHeader>
            <CardContent>
              {earningLoading ? (
                <div className="flex justify-center py-12">
                  <Spinner size="lg" />
                </div>
              ) : byTutor.size === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  No pending earnings. Completed sessions will create earning rows here.
                </div>
              ) : (
                <div className="space-y-6">
                  {Array.from(byTutor.entries()).map(([tutorId, rows]) => {
                    const total = rows.reduce((s, r) => s + Number(r.net_amount), 0);
                    const currency = rows[0]?.currency ?? workspaceCurrency;
                    const profile = tutorMap.get(tutorId)?.profile;
                    const displayName = profile?.display_name || profile?.email || "Tutor";
                    return (
                      <div
                        key={tutorId}
                        className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground">{displayName}</p>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {rows.length} row{rows.length !== 1 ? "s" : ""} ·{" "}
                            {formatCurrency(total, currency, workspaceCurrency)} total
                          </p>
                        </div>
                        <Button
                          size="sm"
                          className="bg-primary text-primary-foreground shrink-0"
                          onClick={() => openCreateModal(tutorId, rows.map((r) => r.id))}
                        >
                          Create payout
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "history" && (
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5 text-muted-foreground" />
                Payout history
              </CardTitle>
            </CardHeader>
            <CardContent>
              {payoutsLoading ? (
                <div className="flex justify-center py-12">
                  <Spinner size="lg" />
                </div>
              ) : payouts.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  No payouts yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">
                          Date
                        </th>
                        <th className="text-left font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">
                          Tutor
                        </th>
                        <th className="text-right font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">
                          Amount
                        </th>
                        <th className="text-right font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">
                          Proof
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {payouts.map((p) => {
                        const profile = tutorMap.get(p.tutor_id)?.profile;
                        const name = profile?.display_name || profile?.email || "Tutor";
                        return (
                          <tr
                            key={p.id}
                            className="border-b border-border/60 hover:bg-muted/20 transition-colors"
                          >
                            <td className="py-3 px-4 text-muted-foreground">
                              {p.paid_at
                                ? new Date(p.paid_at).toLocaleDateString("en-GB", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })
                                : new Date(p.created_at).toLocaleDateString("en-GB")}
                            </td>
                            <td className="py-3 px-4 font-medium">{name}</td>
                            <td className="py-3 px-4 text-right font-semibold tabular-nums">
                              {formatCurrency(Number(p.total_net_amount), p.currency, workspaceCurrency)}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {p.proof_storage_path ? (
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="text-primary p-0 h-auto gap-1"
                                  onClick={() => handleViewProof(p.id)}
                                >
                                  View proof
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Button>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Payout Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md rounded-xl border-border bg-card shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Process Payout</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-primary/80">
                Total selected payout
              </p>
              <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">
                {formatCurrency(selectedTotal.total, selectedTotal.currency, workspaceCurrency)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Tutor: {tutorName}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">
                Internal note
              </label>
              <Textarea
                placeholder="Add a private note about this transaction..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="min-h-[80px] resize-y border-border"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">
                Upload proof of transfer
              </label>
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
                className="w-full rounded-xl border-2 border-dashed border-border bg-muted/30 hover:bg-muted/50 transition-colors py-8 px-4 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
              >
                <Upload className="h-10 w-10 text-muted-foreground/70" />
                <span className="text-sm font-medium">Click or drag to upload receipt</span>
                <span className="text-xs">PDF, JPG or PNG (Max 10MB)</span>
                {proofFile && (
                  <span className="text-xs text-primary font-medium mt-1">
                    {proofFile.name}
                  </span>
                )}
              </button>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground"
              onClick={handleConfirmPayout}
              disabled={createPayoutMutation.isPending}
            >
              {createPayoutMutation.isPending ? (
                <Spinner size="sm" className="mr-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Confirm Payout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
