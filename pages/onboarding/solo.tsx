import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowRight, ArrowLeft, UserCircle } from "lucide-react";
import { BillingPlans } from "@/components/billing/BillingPlans";

const TOTAL_STEPS = 2;

export default function OnboardingSolo() {
  const router = useRouter();
  const { user, role, profile, loading: authLoading, completeOnboarding } = useAuth();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ displayName: "", primarySubjects: "" });
  const isFormValid = formData.displayName.trim().length > 0;

  const isCheckoutSuccess = router.query.checkout === "success";

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/auth");
      return;
    }
    if (role && profile?.onboarding_completed_at) {
      router.replace("/dashboard/teacher");
      return;
    }
    if (role === "student" || (role && role !== "teacher" && role !== "admin")) {
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
      router.replace("/dashboard/teacher");
    })();
  }, [user, isCheckoutSuccess, completedCheckout, completeOnboarding, router]);

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const name = formData.displayName.trim();
    if (!name) {
      toast.error("Please enter your tutoring name or brand.");
      return;
    }
    setSubmitting(true);
    try {
      const { data: workspace, error: workspaceError } = await supabase
        .from("workspaces")
        .insert({
          name,
          type: "solo",
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

  if (step === 1) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-8 shadow-large">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <UserCircle className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground">Set up your tutor profile</h1>
              <p className="text-sm text-muted-foreground">Step 1 of {TOTAL_STEPS}</p>
              <div className="mt-3 flex gap-2">
                {[1, 2].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => s === 2 && workspaceId && setStep(2)}
                    disabled={s === 2 && !workspaceId}
                    className={`h-2 flex-1 rounded-full ${step === s ? "bg-primary" : "bg-muted"}`}
                    aria-label={`Step ${s}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <form onSubmit={handleCreateWorkspace} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Tutoring name / brand <span className="text-destructive">*</span></Label>
              <Input
                id="displayName"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                placeholder={profile?.display_name || "e.g. John's Math Tutoring"}
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
                placeholder="e.g. Math, Physics"
                className="rounded-xl"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              You can invite students and create classes from your Tutor dashboard next.
            </p>
            <div className="flex gap-3">
              <Button type="button" variant="outline" className="rounded-xl" disabled>
                Back
              </Button>
              <Button type="submit" className="flex-1 rounded-xl" disabled={submitting || !isFormValid}>
                {submitting ? "Creating..." : "Create workspace"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-4xl rounded-3xl border border-border bg-card p-8 shadow-large">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <UserCircle className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">Choose your plan</h1>
            <p className="text-sm text-muted-foreground">Step 2 of {TOTAL_STEPS} — You will be redirected to our secure payment page.</p>
            <div className="mt-3 flex gap-2">
              {[1, 2].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStep(s)}
                  className={`h-2 flex-1 rounded-full ${step === s ? "bg-primary" : "bg-muted"}`}
                  aria-label={`Step ${s}`}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="mb-6">
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => setStep(1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
        {workspaceId && (
          <BillingPlans
            planLine="tutor"
            workspaceId={workspaceId}
            userId={user.id}
            successUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/onboarding/solo?checkout=success`}
          />
        )}
      </div>
    </div>
  );
}
