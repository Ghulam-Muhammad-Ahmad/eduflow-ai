import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useHasActiveSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { z } from "zod";
import type { AppRole } from "@/types/auth";

type AuthMode = "signin" | "forgot-password";

const signInSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

function getDashboardPathForRole(role: AppRole): string {
  if (role === "student") return "/dashboard/student";
  if (role === "admin") return "/dashboard/owner";
  return "/dashboard/teacher";
}

export default function Auth() {
  const router = useRouter();
  const { user, role, profile, signIn, resetPassword, loading: authLoading } = useAuth();
  const { hasAccess: hasSubscription, isLoading: subLoading } = useHasActiveSubscription();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [authSuccess, setAuthSuccess] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Redirect old /auth?mode=signup links to register page
  useEffect(() => {
    const q = router.query;
    if (q.mode === "signup") {
      router.replace("/auth/register");
    }
  }, [router]);

  useEffect(() => {
    if (authLoading || !user) return;
    if (role && profile && !subLoading) {
      if ((role === "teacher" || role === "student") && !profile.password_changed_at) {
        router.push("/onboarding/change-password");
        return;
      }
      const completed = profile.onboarding_completed_at;
      if (!completed) {
        router.push("/onboarding/business");
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

    setLoading(true);

    try {
      if (mode === "signin") {
        const validation = signInSchema.safeParse({
          email: formData.email,
          password: formData.password,
        });

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

        const { error } = await signIn(formData.email, formData.password);
        if (error) {
          toast.error(error.message || "Failed to sign in");
          return;
        }

        toast.success("Signed in successfully!");
        setAuthSuccess(true);
      } else if (mode === "forgot-password") {
        const validation = forgotPasswordSchema.safeParse({ email: formData.email });

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

        const { error } = await resetPassword(formData.email);
        if (error) {
          toast.error(error.message || "Failed to send reset email");
          return;
        }

        setEmailSent(true);
        toast.success("Password reset email sent!");
      }
    } catch (error: unknown) {
      toast.error((error as Error)?.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Redirecting after successful sign-in/sign-up
  if (authSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4" style={{ backgroundImage: "var(--gradient-hero)" }}>
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" />
          <p className="text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    );
  }

  // Email sent confirmation - full screen overlay style
  if (emailSent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-3xl bg-card p-8 shadow-large border border-border">
          <div className="flex flex-col items-center space-y-4">
            <div className="rounded-full bg-primary/10 p-4">
              <CheckCircle2 className="h-12 w-12 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Check your email</h2>
            <p className="text-center text-muted-foreground">
              We&apos;ve sent a password reset link to <strong className="text-foreground">{formData.email}</strong>
            </p>
            <Button
              onClick={() => {
                setMode("signin");
                setEmailSent(false);
              }}
              className="w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Back to Sign In
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Two-column layout: image left, form right
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4" style={{ backgroundImage: "var(--gradient-hero)" }}>
      <div className="flex w-full max-w-6xl overflow-hidden rounded-3xl bg-card shadow-large border border-[#cececf]">
        {/* Left panel - image */}
        <div className="relative hidden min-h-[520px] w-[50%] lg:block overflow-hidden">
          <Image
            src="/engineer-talking-with-management-videocall-about-errors-found-code.jpg"
            alt="Professional collaboration"
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

        {/* Right panel - form */}
        <div className="flex w-full flex-col justify-center px-[15px] py-[15px] lg:w-[50%] lg:px-8 lg:py-8 rounded-[15px]">
          <button
            type="button"
            onClick={() => (mode === "forgot-password" ? setMode("signin") : router.back())}
            className="mb-6 flex items-center justify-start gap-1.5 text-sm font-medium text-[#595959] transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {mode === "signin" && "Log in"}
            {mode === "forgot-password" && "Reset Password"}
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signin" && (
              <>
                Don&apos;t have an account?{" "}
                <Link
                  href="/auth/register"
                  className="font-semibold text-primary underline underline-offset-2 hover:text-primary/90"
                >
                  Create an Account
                </Link>
              </>
            )}
            {mode === "forgot-password" && "Enter your email to receive a reset link."}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Email Address"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={`rounded-xl border-input ${errors.email ? "border-destructive" : ""}`}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email}</p>
              )}
            </div>

            {mode !== "forgot-password" && (
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-foreground">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className={`rounded-xl border-input pr-10 ${errors.password ? "border-destructive" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password}</p>
                )}
                {mode === "signin" && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setMode("forgot-password")}
                      className="text-sm text-primary underline underline-offset-2 hover:text-primary/90"
                    >
                      Forgot Password?
                    </button>
                  </div>
                )}
              </div>
            )}

            <Button
              type="submit"
              className="w-full rounded-xl bg-primary py-6 text-base font-medium text-primary-foreground hover:bg-primary/90"
              disabled={loading}
            >
              {loading
                ? "Loading..."
                : mode === "signin"
                ? "Log in"
                : "Send Reset Email"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
