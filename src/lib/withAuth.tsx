import { useRouter } from "next/router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useHasActiveSubscription } from "@/hooks/useSubscription";
import type { AppRole, AccountType } from "@/types/auth";

const ONBOARDING_PATH: Record<AccountType, string> = {
  business: "/onboarding/business",
  student: "/onboarding/student",
  tutor: "/dashboard/teacher", // tenant-created tutors skip onboarding
};

function getOnboardingPath(accountType: AccountType | null): string {
  if (accountType && ONBOARDING_PATH[accountType]) return ONBOARDING_PATH[accountType];
  return "/onboarding/business";
}

interface WithAuthOptions {
  allowedRoles?: AppRole[];
  redirectTo?: string;
}

export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options: WithAuthOptions = {}
) {
  return function AuthenticatedComponent(props: P) {
    const router = useRouter();
    const { user, role, profile, loading } = useAuth();
    const { hasAccess, isLoading: subLoading } = useHasActiveSubscription();
    const { allowedRoles, redirectTo } = options;

    useEffect(() => {
      if (loading) return;

      if (!user) {
        router.push(redirectTo || "/auth");
        return;
      }

      if (allowedRoles && role && !allowedRoles.includes(role)) {
        switch (role) {
          case "teacher":
            router.push("/dashboard/teacher");
            break;
          case "student":
            router.push("/dashboard/student");
            break;
          case "admin":
            router.push("/dashboard/owner");
            break;
          default:
            router.push("/");
        }
        return;
      }

      if (!role) return;

      const onboardingComplete = profile?.onboarding_completed_at != null;
      if (!onboardingComplete && profile) {
        const path = getOnboardingPath(profile.account_type ?? "business");
        router.replace(path);
        return;
      }

      if (!subLoading && !hasAccess) {
        router.replace("/select-plan");
      }
    }, [user, role, profile, loading, subLoading, hasAccess, router, allowedRoles, redirectTo]);

    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      );
    }

    if (!user) {
      return null;
    }

    if (allowedRoles && role && !allowedRoles.includes(role)) {
      return null;
    }

    if (!profile?.onboarding_completed_at && profile) {
      return null;
    }

    if (role && !subLoading && !hasAccess) {
      return null;
    }

    return <Component {...props} />;
  };
}
