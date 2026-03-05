import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/hooks/useAuth";

/**
 * Role selection is removed: all new signups are owners.
 * Redirect to owner onboarding so existing links still work.
 */
export default function ChooseAccountType() {
  const router = useRouter();
  const { user, role, profile, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/auth");
      return;
    }
    if (role && profile?.onboarding_completed_at) {
      if (role === "teacher") router.replace("/dashboard/teacher");
      else if (role === "admin") router.replace("/dashboard/owner");
      else router.replace("/dashboard/student");
      return;
    }
    if (role && !profile?.onboarding_completed_at) {
      router.replace("/onboarding/business");
      return;
    }
    router.replace("/onboarding/business");
  }, [user, role, profile, authLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
