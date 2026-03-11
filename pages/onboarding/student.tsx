import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowRight, GraduationCap } from "lucide-react";
import { BillingPlans } from "@/components/billing/BillingPlans";
import { Spinner } from "@/components/ui/spinner";

export default function OnboardingStudent() {
  const router = useRouter();
  const { user, role, profile, loading: authLoading, completeOnboarding } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [goal, setGoal] = useState("");

  const isCheckoutSuccess = router.query.checkout === "success";

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/auth");
      return;
    }
    if (role && profile?.onboarding_completed_at) {
      router.replace("/dashboard/student");
      return;
    }
    if (role !== "student" && role !== null) {
      router.replace(role === "admin" ? "/dashboard/owner" : "/dashboard/teacher");
      return;
    }
  }, [user, role, profile, authLoading, router]);

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!goal.trim()) {
      toast.error("Please enter your study goal.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await completeOnboarding();
      if (error) throw error;
      toast.success("You're all set!");
      router.replace("/dashboard/student");
    } catch (err) {
      toast.error((err as Error)?.message || "Something went wrong");
    } finally {
      setSubmitting(false);
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
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-8 shadow-large">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <GraduationCap className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground">What's your goal?</h1>
              <p className="text-sm text-muted-foreground">Step 2 of 2 — We'll personalize your study experience</p>
              <div className="mt-3 flex gap-2">
                <div className="h-2 flex-1 rounded-full bg-primary" />
                <div className="h-2 flex-1 rounded-full bg-primary" />
              </div>
            </div>
          </div>

          <form onSubmit={handleComplete} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="goal">Exam prep, subject, or grade <span className="text-destructive">*</span></Label>
              <Input
                id="goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g. SAT Math, Grade 10 Science"
                className="rounded-xl"
                required
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Use Study Hub for practice, get added to a class by your tutor or school, or explore on your own.
            </p>
            <Button type="submit" className="w-full rounded-xl" disabled={submitting || !goal.trim()}>
              {submitting ? "Saving..." : "Continue to dashboard"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
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
            <GraduationCap className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">Choose your plan</h1>
            <p className="text-sm text-muted-foreground">
              Step 1 of 2 — A plan is required. You will be redirected to our secure payment page.
            </p>
            <div className="mt-3 flex gap-2">
              <div className="h-2 flex-1 rounded-full bg-primary" />
              <div className="h-2 flex-1 rounded-full bg-muted" />
            </div>
          </div>
        </div>
        <BillingPlans
          planLine="student"
          userId={user.id}
          successUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/onboarding/student?checkout=success`}
        />
      </div>
    </div>
  );
}
