import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff, ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import Link from "next/link";

type AppRole = "teacher" | "student";
type AuthMode = "signin" | "signup" | "forgot-password";

const signUpSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(["teacher", "student"]),
});

const signInSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export default function Auth() {
  const router = useRouter();
  const { user, signIn, signUp, signInWithGoogle, resetPassword } = useAuth();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    role: "teacher" as AppRole,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user) {
      router.push("/dashboard/teacher");
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!termsAgreed && mode !== "forgot-password") {
      toast.error("Please agree to the Terms & Conditions");
      return;
    }

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
        router.push("/dashboard/teacher");
      } else if (mode === "signup") {
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
        const { error } = await signUp(
          formData.email,
          formData.password,
          displayName,
          formData.role
        );
        if (error) {
          toast.error(error.message || "Failed to sign up");
          return;
        }

        toast.success("Account created successfully!");
        router.push("/dashboard/teacher");
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
      <div className="flex w-full max-w-5xl overflow-hidden rounded-3xl bg-card shadow-large border border-border">
        {/* Left panel - visual (project gradient) */}
        <div className="relative hidden w-[42%] lg:block bg-gradient-to-br from-primary via-primary/90 to-accent">
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          {/* Logo */}
          <div className="absolute left-8 top-8 flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm border border-white/30">
            <span className="text-2xl font-bold text-white">E</span>
          </div>
        </div>

        {/* Right panel - form */}
        <div className="flex w-full flex-col justify-center px-8 py-10 lg:w-[58%] lg:px-12 lg:py-14">
          <button
            type="button"
            onClick={() => (mode === "forgot-password" ? setMode("signin") : router.push("/"))}
            className="mb-6 flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {mode === "signin" && "Log in"}
            {mode === "signup" && "Create an Account"}
            {mode === "forgot-password" && "Reset Password"}
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signin" && (
              <>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className="font-semibold text-primary underline underline-offset-2 hover:text-primary/90"
                >
                  Create an Account
                </button>
              </>
            )}
            {mode === "signup" && (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className="font-semibold text-primary underline underline-offset-2 hover:text-primary/90"
                >
                  Log in
                </button>
              </>
            )}
            {mode === "forgot-password" && "Enter your email to receive a reset link."}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {/* Social login at top - only for login and signup */}
            {mode !== "forgot-password" && (
              <>
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
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
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
              </>
            )}

            {mode === "signup" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-sm font-medium text-foreground">
                    First Name
                  </Label>
                  <Input
                    id="firstName"
                    type="text"
                    placeholder="John"
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    className={`rounded-xl border-input ${errors.firstName ? "border-destructive" : ""}`}
                  />
                  {errors.firstName && (
                    <p className="text-xs text-destructive">{errors.firstName}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-sm font-medium text-foreground">
                    Last Name
                  </Label>
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="Last Name"
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    className={`rounded-xl border-input ${errors.lastName ? "border-destructive" : ""}`}
                  />
                  {errors.lastName && (
                    <p className="text-xs text-destructive">{errors.lastName}</p>
                  )}
                </div>
              </div>
            )}

            {mode === "signup" && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">I am a</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, role: "teacher" })}
                    className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                      formData.role === "teacher"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    Teacher
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, role: "student" })}
                    className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                      formData.role === "student"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    Student
                  </button>
                </div>
              </div>
            )}

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

            {mode !== "forgot-password" && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="terms"
                  checked={termsAgreed}
                  onCheckedChange={(checked) =>
                    setTermsAgreed(checked === true)
                  }
                  className="rounded border-border data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary"
                />
                <label
                  htmlFor="terms"
                  className="text-sm text-muted-foreground cursor-pointer"
                >
                  I agree to the{" "}
                  <span className="font-semibold text-primary underline underline-offset-2">
                    Terms & Condition
                  </span>
                </label>
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
                : mode === "signup"
                ? "Create Account"
                : "Send Reset Email"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
