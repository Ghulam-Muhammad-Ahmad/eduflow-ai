import { useEffect } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { useHasActiveSubscription, useBillingWorkspaceId } from "@/hooks/useSubscription";
import { BillingPlans } from "@/components/billing/BillingPlans";
import type { AppRole } from "@/types/auth";
import type { PlanLine } from "@/lib/billing";

const ROLE_TO_PLAN_LINE: Record<AppRole, PlanLine> = {
  admin: "business",
  teacher: "tutor",
  student: "student",
};

const ROLE_TO_ONBOARDING: Record<AppRole, string> = {
  admin: "/onboarding/business",
  teacher: "/onboarding/solo",
  student: "/onboarding/student",
};

export default function SelectPlanPage() {
  const router = useRouter();
  const { user, role, profile, loading: authLoading } = useAuth();
  const { hasAccess, isLoading: subLoading } = useHasActiveSubscription();
  const workspaceId = useBillingWorkspaceId();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/auth");
      return;
    }
    if (!role) {
      router.replace("/auth/choose-account-type");
      return;
    }
    if (hasAccess) {
      if (role === "admin") router.replace("/dashboard/owner");
      else if (role === "teacher") router.replace("/dashboard/teacher");
      else router.replace("/dashboard/student");
      return;
    }
    if (role !== "student" && !workspaceId && profile?.onboarding_completed_at == null) {
      router.replace(ROLE_TO_ONBOARDING[role]);
      return;
    }
  }, [user, role, profile, authLoading, hasAccess, workspaceId, router]);

  if (authLoading || !user || !role || subLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (hasAccess) return null;

  const planLine = ROLE_TO_PLAN_LINE[role];
  const successUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/select-plan?success=1`;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-4xl rounded-3xl border border-border bg-card p-8 shadow-large">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Image src="/mainlogo.svg" alt="EduLabLoom" width={32} height={32} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Choose your plan</h1>
            <p className="text-sm text-muted-foreground">
              A plan is required to access the platform. You will be redirected to our secure payment page.
            </p>
          </div>
        </div>
        <BillingPlans
          planLine={planLine}
          workspaceId={role === "student" ? null : workspaceId}
          userId={user.id}
          successUrl={successUrl}
        />
      </div>
    </div>
  );
}
