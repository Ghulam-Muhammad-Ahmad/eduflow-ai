import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/hooks/useAuth";
import { useHasActiveSubscription } from "@/hooks/useSubscription";
import { Spinner } from "@/components/ui/spinner";
import type { AppRole } from "@/types/auth";

function getDashboardPathForRole(role: AppRole): string {
  if (role === "student") return "/dashboard/student";
  if (role === "admin") return "/dashboard/owner";
  return "/dashboard/teacher";
}

export default function Index() {
  const router = useRouter();
  const { user, role, profile, loading: authLoading } = useAuth();
  const { hasAccess: hasSubscription, isLoading: subLoading } = useHasActiveSubscription();

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace("/auth");
      return;
    }

    if (!role || !profile) return;

    if (subLoading) return;

    if ((role === "teacher" || role === "student") && !profile.password_changed_at) {
      router.replace("/onboarding/change-password");
      return;
    }

    if (!profile.onboarding_completed_at) {
      router.replace("/onboarding/business");
      return;
    }

    if (!hasSubscription) {
      router.replace("/select-plan");
      return;
    }

    router.replace(getDashboardPathForRole(role));
  }, [user, role, profile, authLoading, subLoading, hasSubscription, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Spinner size="lg" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
