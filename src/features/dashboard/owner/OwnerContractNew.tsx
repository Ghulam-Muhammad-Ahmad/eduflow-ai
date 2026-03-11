"use client";

import { useRouter } from "next/router";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
- The response must begin directly with the title using "#".
- Do NOT include explanations, commentary, or introductory text.
- Do NOT summarize or truncate any section.
- The output must contain a **fully usable legal contract**.
- The response must end after the signature section.

FORMATTING REQUIREMENTS:
- Use "#" for the contract title.
- Use "##" for section headings.
- Use numbered sections when appropriate.
- Use bullet lists for enumerating items.
- Maintain clear, professional Markdown formatting.

CONTEXT USAGE RULES:
- Use the values provided in the Context exactly as written.
- Do NOT invent new business names, tutors, rates, or subjects.
- If a value is missing (such as start date), insert a placeholder in brackets like [Start Date].
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

SIGNATURE SECTION:
End the contract with signature blocks for both parties including:

Workspace / Business Representative  
Name  
Title  
Signature  
Date  

Tutor  
Name  
Signature  
Date  

FINAL RULE:
Return **ONLY the Markdown contract** from the first character to the last character.`;

export default function OwnerContractNew() {
  const router = useRouter();
  const preselectedTutorId = typeof router.query.tutorId === "string" ? router.query.tutorId : null;
  const { workspace, tutors, contractByTutorId, invalidate, isLoading } = useOwnerWorkspace();
  const [selectedTutorId, setSelectedTutorId] = useState<string | null>(preselectedTutorId);
  const [durationPreset, setDurationPreset] = useState<string>("12 months");
  const [durationCustom, setDurationCustom] = useState("");
  const [instructions, setInstructions] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (preselectedTutorId && !contractByTutorId.get(preselectedTutorId)?.contract_body_text) {
      setSelectedTutorId(preselectedTutorId);
    }
  }, [preselectedTutorId, contractByTutorId]);

  const tutorsWithoutContract = tutors.filter((t) => !contractByTutorId.get(t.user_id)?.contract_body_text);
  const contract = selectedTutorId ? contractByTutorId.get(selectedTutorId) : null;
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
      const contextBlock = `Context:
- Business/Workspace: ${workspace?.name ?? "The Business"}
- Tutor: ${tutorName}
- Rate: ${contract.rate_amount} ${contract.rate_currency} per ${contract.pay_type === "per_session" ? "session" : "hour"}
- Subjects: ${subjectsList || "General tutoring"}${contractDuration ? `\n- Contract duration/term: ${contractDuration}` : ""}`;
      const prompt = `${contextBlock}\n\nOwner's instructions:\n${instructions.trim()}`;

      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType: "contract_generation",
          prompt,
          systemInstruction: CONTRACT_SYSTEM_INSTRUCTION,
          model: "gpt-4o-mini",
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

                {/* Step 2: Duration */}
                <section className="p-6 border-b border-border/80">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/15 text-primary text-xs font-medium">
                      2
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

                {/* Step 3: Instructions */}
                {contract && (
                  <section className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/15 text-primary text-xs font-medium">
                        3
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
