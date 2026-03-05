import Link from "next/link";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useAIUsage } from "@/hooks/useAIUsage";
import { ArrowLeft, UserPlus, Eye, EyeOff } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { passwordSchema } from "@/lib/validation";

export default function TeacherCreateStudent() {
  const router = useRouter();
  const { usage, loading: usageLoading, refetch: refetchUsage } = useAIUsage();
  const availableCredits = usage?.remainingCredits ?? 0;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [initialCredits, setInitialCredits] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (availableCredits < initialCredits) setInitialCredits(availableCredits);
  }, [availableCredits]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const displayName = `${firstName.trim()} ${lastName.trim()}`;
    if (!email.trim()) {
      setErrors({ email: "Email is required" });
      return;
    }
    if (!displayName.replace(/\s/g, "")) {
      setErrors({ firstName: "First and last name are required" });
      return;
    }
    const passResult = passwordSchema.safeParse(password);
    if (!passResult.success) {
      setErrors({ password: passResult.error.errors[0]?.message ?? "Password must be at least 6 characters" });
      return;
    }
    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        email: email.trim().toLowerCase(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role: "student",
      };
      if (initialCredits > 0) body.initialCredits = initialCredits;
      const res = await fetch("/api/tenant/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({})) as { message?: string; error?: string; creditsAssigned?: boolean; creditsError?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Failed to create student account");
        if (data.error?.toLowerCase().includes("email")) setErrors({ email: data.error });
        return;
      }
      toast.success(data.message ?? "Student account created. Share the login details with them.");
      if (data.creditsAssigned === false && data.creditsError) {
        toast.warning(`Credits could not be assigned: ${data.creditsError}`);
      }
      void refetchUsage?.();
      router.push("/dashboard/teacher/students");
    } catch {
      toast.error("Failed to create student account");
    } finally {
      setCreating(false);
    }
  };

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6 max-w-md">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/teacher/students">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to My Students
          </Link>
        </Button>

        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <UserPlus className="h-8 w-8 text-primary" />
            <h1 className="text-xl font-bold">Create student account</h1>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Create an account for a student. They will use this email and password to sign in. Share the login details with them securely. They will have access under your workspace and do not need their own plan.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="Alex"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="mt-2"
                />
                {errors.firstName && <p className="text-xs text-destructive mt-1">{errors.firstName}</p>}
              </div>
              <div>
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Smith"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="mt-2"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="email">Email address (unique across the platform)</Label>
              <Input
                id="email"
                type="email"
                placeholder="student@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2"
              />
              {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
            </div>
            <div>
              <Label htmlFor="password">Password (min 6 characters)</Label>
              <div className="relative mt-2">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
            </div>
            <div>
              <div className="flex items-center justify-between mt-2">
                <Label htmlFor="initialCredits">Initial AI credits (optional)</Label>
                <span className="text-sm text-muted-foreground">
                  {initialCredits} / {availableCredits} credits
                </span>
              </div>
              <Slider
                id="initialCredits"
                min={0}
                max={availableCredits <= 0 ? 1 : availableCredits}
                step={1}
                value={[initialCredits]}
                onValueChange={([v]) => setInitialCredits(Math.min(v, availableCredits))}
                disabled={usageLoading || availableCredits === 0}
                className="mt-2"
              />
              {availableCredits > 0 && (
                <div className="flex gap-0.5 mt-2" aria-hidden>
                  {Array.from({ length: 20 }).map((_, i) => {
                    const segmentThreshold = (i + 1) / 20;
                    const filled = initialCredits / availableCredits >= segmentThreshold;
                    return (
                      <div
                        key={i}
                        className={`flex-1 min-w-[4px] rounded-sm transition-colors ${filled ? "bg-primary" : "bg-muted"}`}
                        style={{ height: 8 }}
                      />
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Deduct from workspace pool and assign to this student.</p>
            </div>
            <Button type="submit" disabled={creating}>
              {creating ? "Creating..." : "Create student account"}
            </Button>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
