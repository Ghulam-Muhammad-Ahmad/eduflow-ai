import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowRight, ArrowLeft, Building2 } from "lucide-react";
import { BillingPlans } from "@/components/billing/BillingPlans";

const TOTAL_STEPS = 3;

export default function OnboardingBusiness() {
  const router = useRouter();
  const { user, role, profile, loading: authLoading, completeOnboarding } = useAuth();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ businessName: "", primarySubjects: "", numTutors: "", numStudents: "" });

  /** Restrict input to digits only (non-negative integers). Used for tutor/student counts. */
  const handleNumericChange = (field: "numTutors" | "numStudents", value: string) => {
    const digitsOnly = value.replace(/\D/g, "");
    setFormData((prev) => ({ ...prev, [field]: digitsOnly }));
  };

  const numTutorsN = formData.numTutors.trim() === "" ? NaN : parseInt(formData.numTutors, 10);
  const numStudentsN = formData.numStudents.trim() === "" ? NaN : parseInt(formData.numStudents, 10);
  const isStep1Valid =
    formData.businessName.trim().length > 0 &&
    !isNaN(numTutorsN) &&
    numTutorsN >= 0 &&
    !isNaN(numStudentsN) &&
    numStudentsN >= 0;

  const isCheckoutSuccess = router.query.checkout === "success";

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/auth");
      return;
    }
    if (role && profile?.onboarding_completed_at) {
      router.replace("/dashboard/owner");
      return;
    }
    if (role != null && role !== "admin") {
      router.replace("/dashboard/student");
      return;
    }
  }, [user, role, profile, authLoading, router]);

  const [completedCheckout, setCompletedCheckout] = useState(false);
  useEffect(() => {
    if (!user || !isCheckoutSuccess || completedCheckout) return;
    setCompletedCheckout(true);
    (async () => {
      const { error } = await completeOnboarding();
      if (error) {
        toast.error(error.message || "Failed to complete setup");
        setCompletedCheckout(false);
        return;
      }
      toast.success("You're all set!");
      router.replace("/dashboard/owner");
    })();
  }, [user, isCheckoutSuccess, completedCheckout, completeOnboarding, router]);

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const name = formData.businessName.trim();
    if (!name) {
      toast.error("Please enter your business name.");
      return;
    }
    setSubmitting(true);
    try {
      const { data: workspace, error: workspaceError } = await supabase
        .from("workspaces")
        .insert({
          name,
          type: "business",
          owner_id: user.id,
        })
        .select("id")
        .single();

      if (workspaceError) throw workspaceError;
      if (!workspace?.id) throw new Error("Failed to create workspace");

      const { error: memberError } = await supabase.from("workspace_members").insert({
        workspace_id: workspace.id,
        user_id: user.id,
        role: "owner",
      });
      if (memberError) throw memberError;

      setWorkspaceId(workspace.id);
      toast.success("Workspace created!");
      setStep(3);
    } catch (err) {
      toast.error((err as Error)?.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isCheckoutSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Completing your setup...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-4xl rounded-3xl border border-border bg-card p-8 shadow-large">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">Set up your tutoring business</h1>
            <p className="text-sm text-muted-foreground">Step {step} of {TOTAL_STEPS}</p>
            <div className="mt-3 flex gap-2">
              {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    if (s === 3 && !workspaceId) return;
                    setStep(s);
                  }}
                  disabled={s === 3 && !workspaceId}
                  className={`h-2 flex-1 rounded-full transition-colors ${
                    step === s ? "bg-primary" : "bg-muted"
                  } ${s === 3 && !workspaceId ? "cursor-not-allowed opacity-50" : "hover:bg-primary/70"}`}
                  aria-label={`Go to step ${s}`}
                />
              ))}
            </div>
          </div>
        </div>

        {step === 1 && (
          <>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="businessName">Business name <span className="text-destructive">*</span></Label>
                <Input
                  id="businessName"
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  placeholder="e.g. Acme Tutoring"
                  className="rounded-xl"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="primarySubjects">Primary subjects (optional)</Label>
                <Input
                  id="primarySubjects"
                  value={formData.primarySubjects}
                  onChange={(e) => setFormData({ ...formData, primarySubjects: e.target.value })}
                  placeholder="e.g. Math, Science"
                  className="rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="numTutors">Approx. number of tutors <span className="text-destructive">*</span></Label>
                  <Input
                    id="numTutors"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={formData.numTutors}
                    onChange={(e) => handleNumericChange("numTutors", e.target.value)}
                    placeholder="e.g. 5"
                    className="rounded-xl"
                    required
                    min={0}
                    aria-describedby="numTutors-desc"
                  />
                  <p id="numTutors-desc" className="text-xs text-muted-foreground">
                    Used to tailor your workspace and recommend the right plan. Enter digits only.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numStudents">Approx. number of students <span className="text-destructive">*</span></Label>
                  <Input
                    id="numStudents"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={formData.numStudents}
                    onChange={(e) => handleNumericChange("numStudents", e.target.value)}
                    placeholder="e.g. 50"
                    className="rounded-xl"
                    required
                    min={0}
                    aria-describedby="numStudents-desc"
                  />
                 
                </div>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <Button type="button" variant="outline" className="rounded-xl" disabled>
                Back
              </Button>
              <Button
                type="button"
                className="flex-1 rounded-xl"
                onClick={() => setStep(2)}
                disabled={!isStep1Valid}
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <p className="text-sm text-muted-foreground mb-6">
              We&apos;ll create your workspace. You can invite tutors and students from the Owner dashboard next.
            </p>
            <form onSubmit={handleCreateWorkspace} className="space-y-4">
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setStep(1)}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button type="submit" className="flex-1 rounded-xl" disabled={submitting}>
                  {submitting ? "Creating..." : "Create workspace"}
                </Button>
              </div>
            </form>
          </>
        )}

        {step === 3 && workspaceId && (
          <>
            <p className="text-sm text-muted-foreground mb-6">
              Choose a plan. You will be redirected to our secure payment page to complete checkout.
            </p>
            <div className="mb-6">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setStep(2)}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </div>
            <BillingPlans
              planLine="business"
              workspaceId={workspaceId}
              userId={user.id}
              successUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/onboarding/business?checkout=success`}
            />
          </>
        )}
      </div>
    </div>
  );
}
