"use client";

import { useRouter } from "next/router";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useWorkspaceCurrency } from "@/hooks/useWorkspaceCurrency";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { AmountInput } from "@/components/ui/amount-input";
import { parseAmountFromDisplay } from "@/lib/formatAmount";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, PenLine, FileText, Calendar, Sparkles } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useState, useEffect } from "react";
import { toast } from "sonner";

const DURATION_OPTIONS = [
  { value: "6 months", label: "6 months" },
  { value: "12 months", label: "12 months" },
  { value: "24 months", label: "24 months" },
  { value: "Indefinite", label: "Indefinite" },
  { value: "__custom__", label: "Custom" },
];

const CONTRACT_SYSTEM_INSTRUCTION = `You are a professional legal drafting assistant. Your task is to generate a **complete Tutoring Services Agreement** in Markdown format based strictly on the provided context.

STRICT OUTPUT RULES:
- Output the **entire contract as one continuous Markdown document**.
- Do NOT include a main document title or "# Tutoring Services Agreement" (or similar) at the start. The app displays the title as a static header. Begin directly with the first section (e.g. "## 1. Parties" or "## Parties").
- Do NOT include explanations, commentary, or introductory text.
- Do NOT summarize or truncate any section.
- The output must contain a **fully usable legal contract**.
- Do NOT include any signature section, signature blocks, or signature footer in the contract body. Signatures are displayed separately by the app.

FORMATTING REQUIREMENTS:
- Use "##" for section headings only (no top-level "#" title).
- Use numbered sections when appropriate.
- Use bullet lists for enumerating items.
- Maintain clear, professional Markdown formatting.

PLACEHOLDER RULES (CRITICAL):
- For ANY value not explicitly provided in the Context (addresses, phone numbers, registration numbers, dates, email addresses, bank details, jurisdiction, notice periods if not specified, etc.), you MUST insert a bracketed placeholder in Title Case, e.g. [Client Address], [Business Registration Number], [Governing Law Jurisdiction].
- Do NOT guess, invent, or assume any value. If unsure whether information was provided, use a placeholder.
- Placeholders MUST start with an uppercase letter and contain only letters, spaces, and common punctuation — no URLs, no markdown syntax inside brackets.
- The app highlights these placeholders and lets the owner fill them in interactively before sending the contract to the tutor. This is a core feature — leaving correct placeholders is better than guessing wrong values.

CONTEXT USAGE RULES:
- Use the values provided in the Context exactly as written.
- Do NOT invent new business names, tutors, rates, or subjects.
- The rate and payment structure must match the provided rate context.

MANDATORY CONTRACT CONTENT:
At minimum, include the following sections with professional legal language:

1. Parties
2. Purpose of Agreement
3. Scope of Tutoring Services
4. Subjects Covered
5. Schedule and Availability
6. Term / Duration of Agreement
7. Start Date
8. Compensation and Payment Terms
9. Cancellation and Rescheduling Policy
10. Tutor Responsibilities
11. Workspace Responsibilities
12. Independent Contractor Status
13. Confidentiality
14. Intellectual Property (teaching materials and resources)
15. Non-Solicitation / Non-Circumvention
16. Limitation of Liability
17. Indemnification
18. Governing Law
19. Dispute Resolution
20. Force Majeure
21. Termination and Notice
22. Entire Agreement
23. Amendments
24. Severability
25. Waiver
26. Notices

TERM HANDLING:
- If a contract duration/term is provided in the context, clearly state it in the **Term / Duration** section.
- If no duration is provided, state that the agreement continues until terminated according to the termination clause.

DO NOT ADD SIGNATURES:
- Do not add a signature section, signature blocks, or any "Tutor signature", "Client signature", "Workspace Representative", or similar footer to the contract text. The application displays signatures in a separate area. End the contract after the last substantive clause (e.g. Notices).

FINAL RULE:
Return **ONLY the Markdown contract** from the first character to the last character.`;

export default function OwnerContractNew() {
  const router = useRouter();
  const preselectedTutorId = typeof router.query.tutorId === "string" ? router.query.tutorId : null;
  const { workspace, tutors, contractByTutorId, invalidate, isLoading } = useOwnerWorkspace();
  const workspaceCurrency = useWorkspaceCurrency();
  const [selectedTutorId, setSelectedTutorId] = useState<string | null>(preselectedTutorId);
  const [durationPreset, setDurationPreset] = useState<string>("12 months");
  const [durationCustom, setDurationCustom] = useState("");
  const [payType, setPayType] = useState<"hourly" | "per_session" | "fixed_monthly">("hourly");
  const [rateAmount, setRateAmount] = useState("");
  const [instructions, setInstructions] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (preselectedTutorId && !contractByTutorId.get(preselectedTutorId)?.contract_body_text) {
      setSelectedTutorId(preselectedTutorId);
    }
  }, [preselectedTutorId, contractByTutorId]);

  const tutorsWithoutContract = tutors.filter((t) => !contractByTutorId.get(t.user_id)?.contract_body_text);
  const contract = selectedTutorId ? contractByTutorId.get(selectedTutorId) : null;

  // Sync pay/rate/currency from contract when tutor changes (contract_type takes precedence for billing)
  const contractPayType = (contract as { contract_type?: string } | undefined)?.contract_type ?? contract?.pay_type;
  useEffect(() => {
    if (contract) {
      const pt = contractPayType === "per_session" ? "per_session" : contractPayType === "fixed_monthly" ? "fixed_monthly" : "hourly";
      setPayType(pt);
      setRateAmount(contract.rate_amount != null ? String(contract.rate_amount) : "0");
    }
  }, [contract?.id, contract?.rate_amount, contractPayType]);
  const tutor = selectedTutorId ? tutors.find((t) => t.user_id === selectedTutorId) : null;
  const tutorName = tutor?.profile?.display_name ?? tutor?.profile?.email ?? "Tutor";
  const isCustomDuration = durationPreset === "__custom__";
  const contractDuration = isCustomDuration ? durationCustom.trim() : durationPreset;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contract) {
      toast.error("Select a tutor to generate a contract.");
      return;
    }
    setGenerating(true);
    try {
      const subjectsList = Array.isArray(contract.subjects)
        ? (contract.subjects as string[]).join(", ")
        : typeof contract.subjects === "string"
          ? contract.subjects
          : "";
      const rateVal = parseAmountFromDisplay(rateAmount);
      const currencyVal = workspaceCurrency;
      const contextBlock = `Context:
- Business/Workspace: ${workspace?.name ?? "The Business"}
- Tutor: ${tutorName}
- Pay type: ${payType === "per_session" ? "Per session" : payType === "fixed_monthly" ? "Monthly (fixed)" : "Hourly"}
- Rate amount: ${rateVal}
- Currency: ${currencyVal}
- Rate (for contract): ${rateVal} ${currencyVal} per ${payType === "per_session" ? "session" : payType === "fixed_monthly" ? "month" : "hour"}
- Subjects: ${subjectsList || "General tutoring"}${contractDuration ? `\n- Contract duration/term: ${contractDuration}` : ""}`;
      const prompt = `${contextBlock}\n\nOwner's instructions:\n${instructions.trim()}`;

      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType: "contract_generation",
          prompt,
          systemInstruction: CONTRACT_SYSTEM_INSTRUCTION,
        }),
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as { content?: string; error?: string };
      if (!res.ok) {
        toast.error(res.status === 402 ? (data.error ?? "Insufficient AI credits") : (data.error ?? "Failed to generate contract"));
        return;
      }
      const content = data.content?.trim();
      if (!content) {
        toast.error("AI did not return contract text");
        return;
      }

      const updateRes = await fetch("/api/contracts/update-body", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tutor_contract_id: contract.id,
          contract_body_text: content,
          set_pending_signature: true,
          pay_type: payType,
          contract_type: payType,
          rate_amount: rateVal,
          rate_currency: currencyVal,
        }),
        credentials: "include",
      });
      const updateData = (await updateRes.json().catch(() => ({}))) as { error?: string };
      if (!updateRes.ok) {
        toast.error(updateData.error ?? "Failed to save contract");
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
      <div className="min-h-[calc(100vh-8rem)]">
        <div className="mb-8">
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground -ml-2">
            <Link href="/dashboard/owner/contracts">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Contracts
            </Link>
          </Button>
        </div>

        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <header className="mb-10">
            <div className="flex items-center gap-3 mb-2">
              <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 text-primary">
                <FileText className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Build AI contract</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Generate a full contract in Markdown from your instructions
                </p>
              </div>
            </div>
          </header>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner size="lg" className="text-muted-foreground" />
            </div>
          ) : tutors.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
              <p className="text-muted-foreground">No tutors yet. Create a tutor account first.</p>
            </div>
          ) : tutorsWithoutContract.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
              <p className="text-muted-foreground">
                All tutors already have an AI contract. View or edit them from the Contracts list.
              </p>
            </div>
          ) : (
            <form onSubmit={handleGenerate} className="space-y-0">
              <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
                {/* Step 1: Tutor */}
                <section className="p-6 border-b border-border/80">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/15 text-primary text-xs font-medium">
                      1
                    </span>
                    <Label className="text-base font-medium text-foreground">Choose tutor</Label>
                  </div>
                  <Select
                    value={tutorsWithoutContract.some((t) => t.user_id === selectedTutorId) ? selectedTutorId ?? "" : ""}
                    onValueChange={(v) => setSelectedTutorId(v || null)}
                  >
                    <SelectTrigger id="tutor" className="h-11 bg-background/50">
                      <SelectValue placeholder="Select a tutor" />
                    </SelectTrigger>
                    <SelectContent>
                      {tutorsWithoutContract.map((t) => (
                        <SelectItem key={t.user_id} value={t.user_id}>
                          {t.profile?.display_name ?? t.profile?.email ?? t.user_id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </section>

                {/* Step 2: Pay type, Rate, Currency */}
                {contract && (
                  <section className="p-6 border-b border-border/80">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/15 text-primary text-xs font-medium">
                        2
                      </span>
                      <Label className="text-base font-medium text-foreground">Compensation (for contract)</Label>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="payType">Pay type</Label>
                        <Select value={payType} onValueChange={(v) => setPayType(v as "hourly" | "per_session" | "fixed_monthly")}>
                          <SelectTrigger id="payType" className="mt-2 h-11 bg-background/50">
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
                        <Label htmlFor="rateAmount">Rate amount</Label>
                        <AmountInput
                          id="rateAmount"
                          placeholder="0"
                          value={rateAmount}
                          onChange={setRateAmount}
                          className="mt-2 h-11 bg-background/50"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Currency</Label>
                        <p className="text-sm font-medium text-foreground rounded-md border border-border bg-muted/40 px-3 py-2 inline-block">
                          {workspaceCurrency}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Workspace default currency. Set in Workspace settings.
                        </p>
                      </div>
                    </div>
                  </section>
                )}

                {/* Step 3: Duration */}
                <section className="p-6 border-b border-border/80">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/15 text-primary text-xs font-medium">
                      3
                    </span>
                    <Label className="text-base font-medium text-foreground">Contract duration</Label>
                    <Calendar className="h-4 w-4 text-muted-foreground ml-0.5" />
                  </div>
                  <div className="space-y-3">
                    <Select value={durationPreset} onValueChange={setDurationPreset}>
                      <SelectTrigger className="h-11 bg-background/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DURATION_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isCustomDuration && (
                      <Input
                        value={durationCustom}
                        onChange={(e) => setDurationCustom(e.target.value)}
                        placeholder="e.g. 18 months, Until terminated"
                        className="h-11 bg-background/50"
                      />
                    )}
                  </div>
                </section>

                {/* Step 4: Instructions */}
                {contract && (
                  <section className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/15 text-primary text-xs font-medium">
                        4
                      </span>
                      <Label htmlFor="instructions" className="text-base font-medium text-foreground">
                        Instructions for the AI
                      </Label>
                      <Sparkles className="h-4 w-4 text-muted-foreground ml-0.5" />
                    </div>
                    <Textarea
                      id="instructions"
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      placeholder="e.g. Include: parties (workspace name and tutor name), hourly rate and currency, subjects they will teach, start date from signing, confidentiality, 30-day notice for termination, and that this is the full agreement."
                      rows={6}
                      className="resize-y min-h-[140px] bg-background/50 border-border focus:ring-primary/20"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Optional. Be specific so the AI can generate a complete contract tailored to your needs.
                    </p>
                  </section>
                )}
              </div>

              {/* Submit */}
              <div className="mt-8 pt-[30px] pb-[30px] flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <Button
                  type="submit"
                  disabled={!contract || generating}
                  className="h-11 px-6 font-medium shadow-sm"
                >
                  {generating ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Generating contract…
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate contract
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
