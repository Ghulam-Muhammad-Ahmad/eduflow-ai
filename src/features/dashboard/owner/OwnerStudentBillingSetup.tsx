"use client";

import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AmountInput } from "@/components/ui/amount-input";
import { Label } from "@/components/ui/label";
import { parseAmountFromDisplay } from "@/lib/formatAmount";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Plus, Receipt, DollarSign } from "lucide-react";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useWorkspaceCurrency } from "@/hooks/useWorkspaceCurrency";

type FeeConfig = {
  id: string;
  fee_type: string;
  amount: number;
  currency: string;
  description: string | null;
  active: boolean;
};

const FEE_TYPES = [
  { value: "monthly_fixed", label: "Monthly fixed" },
  { value: "per_session", label: "Per session" },
  { value: "per_hour", label: "Per hour" },
] as const;

export default function OwnerStudentBillingSetup() {
  const router = useRouter();
  const { id: studentId } = router.query;
  const queryClient = useQueryClient();
  const { assignedStudents } = useOwnerWorkspace();

  const workspaceCurrency = useWorkspaceCurrency();
  const student = (assignedStudents as { student_id: string; student?: { display_name?: string; email?: string } }[]).find(
    (s) => s.student_id === studentId
  );
  const displayName = student?.student?.display_name || student?.student?.email || "Student";

  const { data: configsData, isLoading } = useQuery({
    queryKey: ["owner-fee-configs", studentId],
    queryFn: async () => {
      const res = await fetch(`/api/owner/students/${studentId}/fee-configs`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load fee configs");
      return res.json() as Promise<{ configs: FeeConfig[] }>;
    },
    enabled: !!studentId,
  });

  const addConfigMutation = useMutation({
    mutationFn: async (body: { fee_type: string; amount: number; currency: string; description?: string }) => {
      const res = await fetch(`/api/owner/students/${studentId}/fee-configs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to save");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-fee-configs", studentId] });
      toast.success("Fee config saved.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addManualFineMutation = useMutation({
    mutationFn: async (body: { manual_fine: true; amount: number; currency: string; description?: string }) => {
      const res = await fetch(`/api/owner/students/${studentId}/fee-configs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to add fine");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-fee-configs", studentId] });
      queryClient.invalidateQueries({ queryKey: ["owner-students-invoices", studentId] });
      toast.success("Manual fine added.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const configs = (configsData?.configs ?? []) as FeeConfig[];

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
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/dashboard/owner/students/${studentId}`} aria-label="Back to student">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
              Billing setup: {displayName}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Configure fee types and amounts for this student.
            </p>
          </div>
        </div>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Fee configs
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Add or edit fee types. One config per type per student.
            </p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Spinner size="lg" />
              </div>
            ) : (
              <div className="space-y-4">
                {configs.map((cfg) => (
                  <div
                    key={cfg.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 p-4"
                  >
                    <div>
                      <p className="font-medium capitalize">
                        {cfg.fee_type.replace("_", " ")}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {cfg.amount} {cfg.currency}
                        {cfg.description ? ` · ${cfg.description}` : ""}
                      </p>
                    </div>
                    <Badge variant={cfg.active ? "success" : "secondary"}>
                      {cfg.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                ))}
                <AddFeeConfigForm
                  defaultCurrency={workspaceCurrency}
                  onSubmit={(body) => addConfigMutation.mutate(body)}
                  loading={addConfigMutation.isPending}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Add manual fine
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              One-off charge (e.g. late fee, equipment).
            </p>
          </CardHeader>
          <CardContent>
            <AddManualFineForm
              defaultCurrency={workspaceCurrency}
              onSubmit={(body) => addManualFineMutation.mutate({ ...body, manual_fine: true })}
              loading={addManualFineMutation.isPending}
            />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function AddFeeConfigForm({
  defaultCurrency,
  onSubmit,
  loading,
}: {
  defaultCurrency: string;
  onSubmit: (v: { fee_type: string; amount: number; currency: string; description?: string }) => void;
  loading: boolean;
}) {
  const [feeType, setFeeType] = useState<string>("monthly_fixed");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [description, setDescription] = useState("");
  useEffect(() => {
    setCurrency(defaultCurrency);
  }, [defaultCurrency]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseAmountFromDisplay(amount);
    if (num < 0) {
      toast.error("Enter a valid amount");
      return;
    }
    onSubmit({ fee_type: feeType, amount: num, currency, description: description.trim() || undefined });
    setAmount("");
    setDescription("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-border p-4">
      <div className="w-full sm:w-36">
        <Label className="text-xs">Type</Label>
        <select
          value={feeType}
          onChange={(e) => setFeeType(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          {FEE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>
      <div className="w-24">
        <Label className="text-xs">Amount</Label>
        <AmountInput
          value={amount}
          onChange={setAmount}
          placeholder="0"
          className="mt-1"
        />
      </div>
      <div className="w-20">
        <Label className="text-xs">Currency</Label>
        <Input
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="mt-1"
        />
      </div>
      <div className="flex-1 min-w-[120px]">
        <Label className="text-xs">Description (optional)</Label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Tuition"
          className="mt-1"
        />
      </div>
      <Button type="submit" size="sm" disabled={loading} className="gap-1 bg-primary">
        {loading ? <Spinner size="sm" /> : <Plus className="h-4 w-4" />}
        Add config
      </Button>
    </form>
  );
}

function AddManualFineForm({
  defaultCurrency,
  onSubmit,
  loading,
}: {
  defaultCurrency: string;
  onSubmit: (v: { amount: number; currency: string; description?: string }) => void;
  loading: boolean;
}) {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [description, setDescription] = useState("");
  useEffect(() => {
    setCurrency(defaultCurrency);
  }, [defaultCurrency]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseAmountFromDisplay(amount);
    if (num <= 0) {
      toast.error("Enter a positive amount");
      return;
    }
    onSubmit({ amount: num, currency, description: description.trim() || "Manual fine" });
    setAmount("");
    setDescription("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div className="w-28">
        <Label className="text-xs">Amount</Label>
        <AmountInput
          value={amount}
          onChange={setAmount}
          placeholder="0.00"
          className="mt-1"
        />
      </div>
      <div className="w-20">
        <Label className="text-xs">Currency</Label>
        <Input value={currency} onChange={(e) => setCurrency(e.target.value)} className="mt-1" />
      </div>
      <div className="flex-1 min-w-[160px]">
        <Label className="text-xs">Description</Label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Late payment fee"
          className="mt-1"
        />
      </div>
      <Button type="submit" size="sm" disabled={loading} className="gap-1">
        {loading ? <Spinner size="sm" /> : <Plus className="h-4 w-4" />}
        Add fine
      </Button>
    </form>
  );
}
