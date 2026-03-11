import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GraduationCap, Lock, Eye, EyeOff, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const resetPasswordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const ResetPassword = () => {
  const router = useRouter();
  const { updatePassword } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);

  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // Check if the user has a valid recovery session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      // A user arriving from a password reset link will have a session
      setIsValidSession(!!session);
    };

    // Listen for auth state changes (when user clicks the reset link)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, _session) => {
        if (event === "PASSWORD_RECOVERY") {
          setIsValidSession(true);
        }
      }
    );

    checkSession();

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    try {
      const validated = resetPasswordSchema.parse(formData);
      const { error } = await updatePassword(validated.password);

      if (error) {
        toast.error(error.message);
        return;
      }

      setIsSuccess(true);
      toast.success("Password updated successfully!");
      
      // Sign out and redirect to login after 3 seconds
      setTimeout(() => {
        supabase.auth.signOut();
        router.push("/auth");
      }, 3000);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (isValidSession === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Form */}
      <div className="flex-1 flex flex-col justify-center px-8 py-12 lg:px-16 bg-background">
        <div className="max-w-md w-full mx-auto">
          {/* Back Link */}
          <button
            onClick={() => router.push("/auth")}
            className="flex items-center gap-2 text-muted-foreground hover:text-primary mb-8 transition-colors duration-200"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to sign in
          </button>

          {/* Logo */}
          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-medium">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-foreground">
              Edu<span className="gradient-text">LabLoom</span>
            </span>
          </div>

          {/* Invalid Session State */}
          {!isValidSession && (
            <div className="space-y-6">
              <div className="flex flex-col items-center justify-center text-center p-8 rounded-2xl bg-destructive/5 border border-destructive/20">
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                  <AlertCircle className="w-8 h-8 text-destructive" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Invalid or Expired Link</h3>
                <p className="text-muted-foreground mb-4">
                  This password reset link is invalid or has expired. Please request a new one.
                </p>
              </div>
              <Button
                variant="default"
                className="w-full"
                size="lg"
                onClick={() => router.push("/auth")}
              >
                Request New Reset Link
              </Button>
            </div>
          )}

          {/* Success State */}
          {isValidSession && isSuccess && (
            <div className="space-y-6">
              <div className="flex flex-col items-center justify-center text-center p-8 rounded-2xl bg-primary/5 border border-primary/20">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Password Updated!</h3>
                <p className="text-muted-foreground">
                  Your password has been successfully updated. You will be redirected to sign in shortly.
                </p>
              </div>
              <Button
                variant="default"
                className="w-full"
                size="lg"
                onClick={() => {
                  supabase.auth.signOut();
                  router.push("/auth");
                }}
              >
                Sign In Now
              </Button>
            </div>
          )}

          {/* Reset Form */}
          {isValidSession && !isSuccess && (
            <>
              {/* Header */}
              <div className="mb-8">
                <h1 className="text-2xl font-bold mb-2 text-foreground">
                  Create new password
                </h1>
                <p className="text-muted-foreground">
                  Your new password must be at least 6 characters long
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-foreground">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pl-10 pr-10"
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-foreground">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pl-10 pr-10"
                      value={formData.confirmPassword}
                      onChange={(e) =>
                        setFormData({ ...formData, confirmPassword: e.target.value })
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  variant="default"
                  className="w-full"
                  size="lg"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Updating..." : "Update Password"}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>

      {/* Right Side - Decorative */}
      <div className="hidden lg:flex flex-1 bg-gradient-dark relative overflow-hidden noise-overlay">
        <div className="absolute inset-0 opacity-30 z-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/30 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-slime-lime/20 blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-center items-center text-center p-16">
          <h2 className="text-4xl font-bold text-platinum mb-6">
            Secure Your Account
          </h2>
          <p className="text-platinum/80 text-lg max-w-md">
            Choose a strong password to keep your account safe and secure.
          </p>
          <div className="mt-12 space-y-4 text-left w-full max-w-md">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 backdrop-blur-sm">
              <CheckCircle2 className="w-5 h-5 text-slime-lime" />
              <span className="text-platinum/90">At least 6 characters long</span>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 backdrop-blur-sm">
              <CheckCircle2 className="w-5 h-5 text-slime-lime" />
              <span className="text-platinum/90">Mix of letters and numbers</span>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 backdrop-blur-sm">
              <CheckCircle2 className="w-5 h-5 text-slime-lime" />
              <span className="text-platinum/90">Avoid common passwords</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
