import { useEffect } from "react";
import { useRouter } from "next/router";

/**
 * Solo tutor onboarding is removed. Only owners (business) have tenant users (tutors, students).
 * Redirect legacy /onboarding/solo links to business onboarding.
 */
export default function OnboardingSoloRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/onboarding/business");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
