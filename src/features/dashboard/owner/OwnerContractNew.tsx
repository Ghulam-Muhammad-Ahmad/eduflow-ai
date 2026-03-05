"use client";

import { useRouter } from "next/router";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, PenLine, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function OwnerContractNew() {
  const router = useRouter();
  const preselectedTutorId = typeof router.query.tutorId === "string" ? router.query.tutorId : null;
  const { tutors, tutorContracts, contractByTutorId, invalidate, isLoading } = useOwnerWorkspace();
  const [selectedTutorId, setSelectedTutorId] = useState<string | null>(preselectedTutorId);
  const [instructions, setInstructions] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (preselectedTutorId) setSelectedTutorId(preselectedTutorId);
  }, [preselectedTutorId]);

  const contract = selectedTutorId ? contractByTutorId.get(selectedTutorId) : null;
  const tutor = selectedTutorId ? tutors.find((t) => t.user_id === selectedTutorId) : null;
  const tutorName = tutor?.profile?.display_name ?? tutor?.profile?.email ?? "Tutor";

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contract || !instructions.trim() || instructions.trim().length < 10) {
      toast.error("Select a tutor and provide instructions (at least 10 characters) for the AI.");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/contracts/generate-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tutor_contract_id: contract.id,
          instructions: instructions.trim(),
        }),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((data as { error?: string }).error ?? "Failed to generate contract");
        return;
      }
      toast.success("Contract generated. You can preview and export it from the contract page.");
      invalidate();
      router.push(`/dashboard/owner/contracts/${contract.id}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/owner/contracts">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Contracts
          </Link>
        </Button>

        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <PenLine className="h-8 w-8 text-primary" />
            <h1 className="text-xl font-bold">Build AI contract</h1>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Choose a tutor and describe what the contract should include. The AI will generate a formal contract in Markdown; you can preview it, revise by prompt, then export as PDF.
          </p>

          {isLoading ? (
            <p className="text-muted-foreground">Loading tutors…</p>
          ) : tutors.length === 0 ? (
            <p className="text-muted-foreground">No tutors yet. Create a tutor account first.</p>
          ) : (
            <form onSubmit={handleGenerate} className="space-y-6">
              <div>
                <Label htmlFor="tutor">Tutor</Label>
                <Select
                  value={selectedTutorId ?? ""}
                  onValueChange={(v) => setSelectedTutorId(v || null)}
                >
                  <SelectTrigger id="tutor" className="mt-2">
                    <SelectValue placeholder="Select a tutor" />
                  </SelectTrigger>
                  <SelectContent>
                    {tutors.map((t) => (
                      <SelectItem key={t.user_id} value={t.user_id}>
                        {t.profile?.display_name ?? t.profile?.email ?? t.user_id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {contract && (
                <div>
                  <Label htmlFor="instructions">Your instructions for the AI</Label>
                  <Textarea
                    id="instructions"
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="e.g. Include: parties (workspace name and tutor name), hourly rate and currency, subjects they will teach, start date from signing, confidentiality, 30-day notice for termination, and that this is the full agreement."
                    rows={6}
                    className="mt-2"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Be specific so the AI can generate an accurate contract. Minimum 10 characters.
                  </p>
                </div>
              )}

              <Button type="submit" disabled={!contract || instructions.trim().length < 10 || generating}>
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  "Generate contract"
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
