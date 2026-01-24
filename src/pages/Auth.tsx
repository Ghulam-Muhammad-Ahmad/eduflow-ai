import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GraduationCap, Mail, Lock, User, Eye, EyeOff, ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

type AppRole = "teacher" | "student";
type AuthMode = "signin" | "signup" | "forgot-password";

const signUpSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  displayName: z.string().min(2, "Display name must be at least 2 characters").max(50),
  role: z.enum(["teacher", "student"]),
});

const signInSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

const Auth = () => {
  const navigate = useNavigate();
  const { user, role, signUp, signIn, resetPassword, loading } = useAuth();
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    displayName: "",
    role: "student" as AppRole,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && user && role) {
      redirectBasedOnRole(role);
    }
  }, [user, role, loading]);

  const redirectBasedOnRole = (userRole: string) => {
    switch (userRole) {
      case "teacher":
        navigate("/dashboard/teacher");
        break;
      case "student":
        navigate("/dashboard/student");
        break;
      case "admin":
        navigate("/dashboard/admin");
        break;
      default:
        navigate("/");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    try {
      if (authMode === "signup") {
        const validated = signUpSchema.parse(formData);
        const { error } = await signUp(
          validated.email,
          validated.password,
          validated.displayName,
          validated.role
        );

        if (error) {
          if (error.message.includes("already registered")) {
            toast.error("This email is already registered. Please sign in instead.");
          } else {
            toast.error(error.message);
          }
          return;
        }

        toast.success("Account created successfully!");
        // The auth state change will trigger redirect
      } else if (authMode === "forgot-password") {
        const validated = forgotPasswordSchema.parse({ email: formData.email });
        const { error } = await resetPassword(validated.email);

        if (error) {
          toast.error(error.message);
          return;
        }

        setResetEmailSent(true);
        toast.success("Password reset email sent! Check your inbox.");
      } else {
        const validated = signInSchema.parse(formData);
        const { error } = await signIn(validated.email, validated.password);

        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast.error("Invalid email or password. Please try again.");
          } else {
            toast.error(error.message);
          }
          return;
        }

        toast.success("Welcome back!");
        // The auth state change will trigger redirect
      }
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

  const switchMode = (mode: AuthMode) => {
    setAuthMode(mode);
    setErrors({});
    setResetEmailSent(false);
  };

  const getHeaderContent = () => {
    switch (authMode) {
      case "signup":
        return {
          title: "Create your account",
          subtitle: "Start your learning journey today",
        };
      case "forgot-password":
        return {
          title: "Reset your password",
          subtitle: "Enter your email and we'll send you a reset link",
        };
      default:
        return {
          title: "Welcome back",
          subtitle: "Sign in to continue to your dashboard",
        };
    }
  };

  const roles = [
    { value: "student", label: "Student", icon: "📚", description: "Learn and track progress" },
    { value: "teacher", label: "Teacher", icon: "🎓", description: "Create lessons and grade" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
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
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-muted-foreground hover:text-primary mb-8 transition-colors duration-200"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
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

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-2 text-foreground">
              {getHeaderContent().title}
            </h1>
            <p className="text-muted-foreground">
              {getHeaderContent().subtitle}
            </p>
          </div>

          {/* Forgot Password Success State */}
          {authMode === "forgot-password" && resetEmailSent ? (
            <div className="space-y-6">
              <div className="flex flex-col items-center justify-center text-center p-8 rounded-2xl bg-primary/5 border border-primary/20">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Check your email</h3>
                <p className="text-muted-foreground mb-4">
                  We've sent a password reset link to <span className="font-medium text-foreground">{formData.email}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Didn't receive the email? Check your spam folder or{" "}
                  <button
                    type="button"
                    onClick={() => setResetEmailSent(false)}
                    className="text-primary font-medium hover:underline"
                  >
                    try again
                  </button>
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                size="lg"
                onClick={() => switchMode("signin")}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Sign In
              </Button>
            </div>
          ) : (
            <>
              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                {authMode === "signup" && (
                  <div className="space-y-2">
                    <Label htmlFor="displayName" className="text-foreground">Display Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="displayName"
                        type="text"
                        placeholder="John Doe"
                        className="pl-10"
                        value={formData.displayName}
                        onChange={(e) =>
                          setFormData({ ...formData, displayName: e.target.value })
                        }
                      />
                    </div>
                    {errors.displayName && (
                      <p className="text-sm text-destructive">{errors.displayName}</p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      className="pl-10"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                    />
                  </div>
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>

                {authMode !== "forgot-password" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-foreground">Password</Label>
                      {authMode === "signin" && (
                        <button
                          type="button"
                          onClick={() => switchMode("forgot-password")}
                          className="text-sm text-primary hover:underline"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
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
                )}

                {authMode === "signup" && (
                  <div className="space-y-3">
                    <Label className="text-foreground">I am a...</Label>
                    <div className="grid grid-cols-2 gap-4">
                      {roles.map((r) => (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() =>
                            setFormData({ ...formData, role: r.value as AppRole })
                          }
                          className={`group relative p-5 rounded-2xl border-2 text-left transition-all duration-300 ${
                            formData.role === r.value
                              ? "border-primary bg-primary/5 shadow-large"
                              : "border-border bg-card hover:border-primary/40 hover:shadow-medium"
                          }`}
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-2xl">{r.icon}</span>
                            <span className={`font-semibold ${formData.role === r.value ? "text-primary" : "text-foreground"}`}>
                              {r.label}
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {r.description}
                          </div>
                          {formData.role === r.value && (
                            <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    {errors.role && (
                      <p className="text-sm text-destructive">{errors.role}</p>
                    )}
                  </div>
                )}

                <Button
                  type="submit"
                  variant="default"
                  className="w-full"
                  size="lg"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? "Please wait..."
                    : authMode === "signup"
                    ? "Create Account"
                    : authMode === "forgot-password"
                    ? "Send Reset Link"
                    : "Sign In"}
                </Button>
              </form>

              {/* Toggle */}
              <div className="mt-6 text-center">
                {authMode === "forgot-password" ? (
                  <p className="text-muted-foreground">
                    Remember your password?{" "}
                    <button
                      type="button"
                      onClick={() => switchMode("signin")}
                      className="text-primary font-medium hover:underline"
                    >
                      Sign in
                    </button>
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    {authMode === "signup" ? "Already have an account?" : "Don't have an account?"}{" "}
                    <button
                      type="button"
                      onClick={() => switchMode(authMode === "signup" ? "signin" : "signup")}
                      className="text-primary font-medium hover:underline"
                    >
                      {authMode === "signup" ? "Sign in" : "Sign up"}
                    </button>
                  </p>
                )}
              </div>
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
            Transform Education with AI
          </h2>
          <p className="text-platinum/80 text-lg max-w-md">
            Join thousands of educators and learners using EduLabLoom to create
            smarter, more personalized learning experiences.
          </p>
          <div className="mt-12 grid grid-cols-2 gap-8">
            <div className="text-center p-4 rounded-xl bg-white/5 backdrop-blur-sm">
              <div className="text-3xl font-bold text-slime-lime">10K+</div>
              <div className="text-platinum/70 text-sm">Active Users</div>
            </div>
            <div className="text-center p-4 rounded-xl bg-white/5 backdrop-blur-sm">
              <div className="text-3xl font-bold text-slime-lime">95%</div>
              <div className="text-platinum/70 text-sm">Time Saved</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
