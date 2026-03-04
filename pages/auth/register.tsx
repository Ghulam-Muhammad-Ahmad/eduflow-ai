import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useHasActiveSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import type { AppRole, AccountType } from "@/types/auth";
import { strongPasswordSchema } from "@/lib/validation";

const signUpSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: strongPasswordSchema,
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(["teacher", "student"]).optional(),
  accountType: z.enum(["business", "solo_tutor", "student"]).optional(),
}).refine((d) => d.accountType != null || d.role != null, { message: "Choose how you'll use the platform", path: ["accountType"] });

function getDashboardPathForRole(role: AppRole): string {
  if (role === "student") return "/dashboard/student";
  if (role === "admin") return "/dashboard/owner";
  return "/dashboard/teacher";
}

function getOnboardingPathForAccountType(accountType: AccountType): string {
  if (accountType === "business") return "/onboarding/business";
  if (accountType === "solo_tutor") return "/onboarding/solo";
  return "/onboarding/student";
}

const ACCOUNT_TYPES: { value: AccountType; label: string; description: string }[] = [
  { value: "business", label: "Tutoring Business", description: "Manage tutors & students" },
  { value: "solo_tutor", label: "Solo Tutor", description: "One tutor, your students" },
  { value: "student", label: "Student", description: "Self-study only" },
];

export default function Register() {
  const router = useRouter();
  const { user, role, profile, signUp, signInWithGoogle, loading: authLoading } = useAuth();
  const { hasAccess: hasSubscription, isLoading: subLoading } = useHasActiveSubscription();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [authSuccess, setAuthSuccess] = useState(false);

  const accountTypeFromQuery = (router.query.accountType as AccountType) || null;
  const effectiveAccountType = accountTypeFromQuery && ACCOUNT_TYPES.some((a) => a.value === accountTypeFromQuery) ? accountTypeFromQuery : null;

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    role: "teacher" as AppRole,
    accountType: null as AccountType | null,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (effectiveAccountType) {
      setFormData((prev) => ({ ...prev, accountType: effectiveAccountType }));
    }
  }, [effectiveAccountType]);

  useEffect(() => {
    if (authLoading || !user) return;
    if (authSuccess) return;
    if (role && profile && !subLoading) {
      const at = profile.account_type;
      const completed = profile.onboarding_completed_at;
      if (at && !completed) {
        router.push(getOnboardingPathForAccountType(at));
        return;
      }
      if (!hasSubscription) {
        router.replace("/select-plan");
        return;
      }
      router.push(getDashboardPathForRole(role));
    }
  }, [user, role, profile, authLoading, authSuccess, subLoading, hasSubscription, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!termsAgreed) {
      toast.error("Please agree to the Terms & Conditions");
      return;
    }

    setLoading(true);

    try {
      const validation = signUpSchema.safeParse(formData);

      if (!validation.success) {
        const fieldErrors: Record<string, string> = {};
        validation.error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(fieldErrors);
        return;
      }

      const displayName = `${formData.firstName.trim()} ${formData.lastName.trim()}`;
      const accountType: AccountType | AppRole = formData.accountType ?? (formData.role === "student" ? "student" : "solo_tutor");
      const { error } = await signUp(
        formData.email,
        formData.password,
        displayName,
        accountType
      );
      if (error) {
        toast.error(error.message || "Failed to sign up");
        return;
      }

      toast.success("Account created successfully!");
      setAuthSuccess(true);
      const path = typeof accountType === "string" && (accountType === "business" || accountType === "solo_tutor" || accountType === "student")
        ? getOnboardingPathForAccountType(accountType)
        : getDashboardPathForRole(accountType as AppRole);
      router.push(path);
    } catch (error: unknown) {
      toast.error((error as Error)?.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (authSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4" style={{ backgroundImage: "var(--gradient-hero)" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <p className="text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4" style={{ backgroundImage: "var(--gradient-hero)" }}>
      <div className="flex w-full max-w-6xl overflow-hidden rounded-3xl bg-card shadow-large border border-border">
        <div className="relative hidden min-h-[520px] w-[45%] lg:block overflow-hidden">
          <Image
            src="/young-man-learning-virtual-classroom.jpg"
            alt="Virtual learning and collaboration"
            fill
            className="object-cover"
            sizes="42vw"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          <div className="absolute left-8 top-8 flex h-16 w-16 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 p-2">
            <Image
              src="/mainlogo.svg"
              alt="EduLabLoom Logo"
              width={48}
              height={48}
              className="w-full h-full"
            />
          </div>
        </div>

        <div className="flex w-full flex-col justify-center px-5 py-5 lg:w-[55%] lg:px-8 lg:py-8">
          <Link
            href="/"
            className="mb-6 flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary w-fit"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>

          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Create an Account
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/auth"
              className="font-semibold text-primary underline underline-offset-2 hover:text-primary/90"
            >
              Log in
            </Link>
          </p>

          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-xl border-border bg-card py-6 hover:bg-secondary"
              onClick={async () => {
                const { error } = await signInWithGoogle();
                if (error) toast.error(error.message || "Google sign-in failed");
              }}
            >
              <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </Button>
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-card px-3 text-sm text-muted-foreground">or</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="text-sm font-medium text-foreground">First Name</Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="John"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className={`rounded-xl border-input ${errors.firstName ? "border-destructive" : ""}`}
                />
                {errors.firstName && <p className="text-xs text-destructive">{errors.firstName}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-sm font-medium text-foreground">Last Name</Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Last Name"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className={`rounded-xl border-input ${errors.lastName ? "border-destructive" : ""}`}
                />
                {errors.lastName && <p className="text-xs text-destructive">{errors.lastName}</p>}
              </div>
            </div>

            {/* What are you here for? - rewritten as single checkboxes */}
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-foreground">
                What are you here for?
              </h2>
              <div className="flex gap-2">
                {ACCOUNT_TYPES.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-3 rounded-lg border border-border px-3 py-3 cursor-pointer transition-colors bg-card hover:bg-primary/10 relative w-full ${formData.accountType === opt.value ? 'border-primary' : ''}`}
                  >
                    <Checkbox
                      checked={formData.accountType === opt.value}
                      onCheckedChange={(checked) => {
                        setFormData({
                          ...formData,
                          accountType: checked ? opt.value : null,
                          role: opt.value === "student" ? "student" : "teacher",
                        });
                      }}
                      className="mt-[2px] rounded border-border data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary absolute right-2 top-2"
                      id={`accountType-${opt.value}`}
                    />
                    <div>
                      <span className="font-medium text-sm text-foreground">{opt.label}</span>
                      <span className="text-xs block text-muted-foreground mt-0.5">{opt.description}</span>
                    </div>
                  </label>
                ))}
              </div>
              {errors.accountType && <p className="text-xs text-destructive">{errors.accountType}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="Email Address"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={`rounded-xl border-input ${errors.email ? "border-destructive" : ""}`}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min 8 chars, uppercase, lowercase, number"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={`rounded-xl border-input pr-10 ${errors.password ? "border-destructive" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
             
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="terms"
                checked={termsAgreed}
                onCheckedChange={(checked) => setTermsAgreed(checked === true)}
                className="rounded border-border data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary"
              />
              <label htmlFor="terms" className="text-sm text-muted-foreground cursor-pointer">
                I agree to the{" "}
                <span className="font-semibold text-primary underline underline-offset-2">Terms & Conditions</span>
              </label>
            </div>

            <Button
              type="submit"
              className="w-full rounded-xl bg-primary py-6 text-base font-medium text-primary-foreground hover:bg-primary/90"
              disabled={loading}
            >
              {loading ? "Loading..." : "Create Account"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
