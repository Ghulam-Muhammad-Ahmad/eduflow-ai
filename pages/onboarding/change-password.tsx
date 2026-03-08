import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { resetPasswordSchema } from "@/lib/validation";

const CHANGE_PASSWORD_PATH = "/onboarding/change-password";

export default function OnboardingChangePassword() {
  const router = useRouter();
  const { user, role, profile, loading: authLoading, updatePassword, setPasswordChanged } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/auth");
      return;
    }
    // Only teacher and student must complete this step; admin (owner) is not forced
    if (role !== "teacher" && role !== "student") {
      router.replace(role === "admin" ? "/dashboard/owner" : "/auth");
      return;
    }
    if (profile?.password_changed_at) {
      router.replace(role === "teacher" ? "/dashboard/teacher" : "/dashboard/student");
      return;
    }
  }, [user, role, profile, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = resetPasswordSchema.safeParse({ password, confirmPassword });
    if (!result.success) {
      const firstError = result.error.errors[0];
      toast.error(firstError?.message ?? "Invalid input");
      return;
    }

    setSubmitting(true);
    try {
      const { error: updateErr } = await updatePassword(result.data.password);
      if (updateErr) {
        toast.error(updateErr.message || "Failed to update password");
        setSubmitting(false);
        return;
      }
      const { error: profileErr } = await setPasswordChanged();
      if (profileErr) {
        toast.error("Password updated but we couldn't complete setup. Please try again from Settings.");
      } else {
        toast.success("Password updated. Welcome!");
      }
      router.replace(role === "teacher" ? "/dashboard/teacher" : "/dashboard/student");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || !user || (role !== "teacher" && role !== "student")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (profile?.password_changed_at) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-card p-8 shadow-lg">
        <div className="flex flex-col items-center space-y-2">
          <div className="rounded-full bg-primary/10 p-3">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Set your password</h1>
          <p className="text-center text-sm text-muted-foreground">
            For your security, please choose a new password. You’ll use this to sign in from now on.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10 pr-10"
                required
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Updating…" : "Continue"}
          </Button>
        </form>
      </div>
    </div>
  );
}

export { CHANGE_PASSWORD_PATH };
