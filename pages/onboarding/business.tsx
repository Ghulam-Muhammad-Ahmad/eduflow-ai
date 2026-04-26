import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowRight, ArrowLeft, Building2, LogOut } from "lucide-react";
import { BillingPlans } from "@/components/billing/BillingPlans";
import { Spinner } from "@/components/ui/spinner";

const TOTAL_STEPS = 2;

export default function OnboardingBusiness() {
  const router = useRouter();
  const { user, role, profile, loading: authLoading, completeOnboarding, signOut } = useAuth();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
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

  /** Load existing workspace so we only allow one per owner; skip step 1 if they already have one. */
  const [existingWorkspaceLoaded, setExistingWorkspaceLoaded] = useState(false);
  useEffect(() => {
    if (!user || role !== "admin") return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("workspaces")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setExistingWorkspaceLoaded(true);
      if (data?.id) {
        setWorkspaceId(data.id);
        setStep(2);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, role]);

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
      const { data: existing } = await supabase
        .from("workspaces")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (existing?.id) {
        setWorkspaceId(existing.id);
        setStep(2);
        toast.success("Welcome back. Continue to choose a plan.");
        return;
      }
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
      setStep(2);
    } catch (err) {
      toast.error((err as Error)?.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      toast.success("Logged out successfully");
      router.replace("/auth");
    } catch (err) {
      toast.error((err as Error)?.message || "Failed to logout");
      setLoggingOut(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isCheckoutSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" />
          <p className="text-sm text-muted-foreground">Completing your setup...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
        <div className="text-sm text-muted-foreground">
          Logged in as: <span className="font-medium text-foreground">{user?.email}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          disabled={loggingOut}
          className="rounded-lg"
        >
          <LogOut className="mr-2 h-4 w-4" />
          {loggingOut ? "Logging out..." : "Logout"}
        </Button>
      </div>
      <div className="flex flex-1 items-center justify-center p-4">
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
                    if (s === 2 && !workspaceId) return;
                    setStep(s);
                  }}
                  disabled={s === 2 && !workspaceId}
                  className={`h-2 flex-1 rounded-full transition-colors ${
                    step === s ? "bg-primary" : "bg-muted"
                  } ${s === 2 && !workspaceId ? "cursor-not-allowed opacity-50" : "hover:bg-primary/70"}`}
                  aria-label={`Go to step ${s}`}
                />
              ))}
            </div>
          </div>
        </div>

        {step === 1 && !workspaceId && !existingWorkspaceLoaded && (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        )}

        {step === 1 && !workspaceId && existingWorkspaceLoaded && (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              We&apos;ll create your workspace. You can invite tutors and students from the Owner dashboard next.
            </p>
            <form onSubmit={handleCreateWorkspace} className="space-y-4">
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
                  type="submit"
                  className="flex-1 rounded-xl"
                  disabled={!isStep1Valid || submitting}
                >
                  {submitting ? "Creating..." : "Create workspace"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </form>
          </>
        )}

        {step === 1 && workspaceId && (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              Your workspace is ready. Continue to choose a plan.
            </p>
            <div className="mt-6">
              <Button
                type="button"
                className="rounded-xl"
                onClick={() => setStep(2)}
              >
                Continue to plan selection
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </>
        )}

        {step === 2 && workspaceId && (
          <>
            <p className="text-sm text-muted-foreground mb-6">
              Choose a plan to get started with your tutoring business.
            </p>
            <div className="mb-6">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setStep(1)}
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
    </div>
  );
}
