import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { Building2, UserCircle, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import type { AccountType } from "@/types/auth";

const ACCOUNT_OPTIONS: { value: AccountType; label: string; description: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "business", label: "Tutoring Business", description: "Manage tutors, students & billing. Owner dashboard.", icon: Building2 },
  { value: "solo_tutor", label: "Solo Tutor", description: "One tutor, your students. Create classes & assignments.", icon: UserCircle },
  { value: "student", label: "Student", description: "Self-study & join classes. AI study tools.", icon: GraduationCap },
];

const ONBOARDING_PATH: Record<AccountType, string> = {
  business: "/onboarding/business",
  solo_tutor: "/onboarding/solo",
  student: "/onboarding/student",
};

export default function ChooseAccountType() {
  const router = useRouter();
  const { user, role, profile, loading: authLoading, setAccountTypeForOAuthUser } = useAuth();
  const [selecting, setSelecting] = useState(false);

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
    if (role && profile?.account_type && !profile?.onboarding_completed_at) {
      router.replace(ONBOARDING_PATH[profile.account_type]);
    }
  }, [user, role, profile, authLoading, router]);

  const handleSelect = async (accountType: AccountType) => {
    setSelecting(true);
    const { error } = await setAccountTypeForOAuthUser(accountType);
    setSelecting(false);
    if (error) {
      toast.error(error.message || "Failed to set account type");
      return;
    }
    toast.success("Welcome!");
    router.replace(ONBOARDING_PATH[accountType]);
  };

  if (authLoading || !user || (role && profile?.onboarding_completed_at)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-4xl overflow-hidden rounded-3xl border border-border bg-card shadow-large">
        <div className="hidden w-[40%] bg-gradient-to-br from-primary/90 via-primary to-primary/80 p-8 lg:flex lg:flex-col lg:justify-center">
          <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm w-fit">
            <Image src="/mainlogo.svg" alt="EduLabLoom" width={48} height={48} className="h-12 w-12" />
          </div>
          <h2 className="mt-6 text-xl font-semibold text-white">Welcome to Edulabloom</h2>
          <p className="mt-2 text-sm text-white/90">
            Choose how you&apos;ll use the platform. You can get started in seconds.
          </p>
        </div>

        <div className="flex w-full flex-col justify-center px-8 py-10 lg:w-[60%] lg:px-12 lg:py-14">
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              What are you here for?
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Select your account type to continue. This helps us show you the right dashboard.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {ACCOUNT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                disabled={selecting}
                className="group flex flex-col items-center gap-4 rounded-2xl border-2 border-border bg-card p-6 text-left transition-all duration-200 hover:border-primary hover:bg-primary/5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-60 disabled:pointer-events-none"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                  <opt.icon className="h-8 w-8" />
                </div>
                <div className="space-y-1 text-center">
                  <span className="block font-semibold text-foreground">{opt.label}</span>
                  <span className="block text-sm text-muted-foreground">{opt.description}</span>
                </div>
              </button>
            ))}
          </div>

          {selecting && (
            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Setting up your account...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
