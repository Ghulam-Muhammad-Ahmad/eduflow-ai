import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useAIUsage } from "@/hooks/useAIUsage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, UserPlus, Eye, EyeOff, Copy, CheckCircle2, KeyRound, ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { passwordSchema } from "@/lib/validation";
import { useWorkspaceStorageSummary } from "@/hooks/useStorage";
import {
  bytesToWholeMb,
  formatStorageSize,
  getStorageSliderStepMb,
} from "@/lib/storage-quota";

type CreatedStudent = {
  userId: string;
  email: string;
  displayName: string;
  password: string;
};

export default function OwnerInviteStudent() {
  const { workspaceId } = useOwnerWorkspace();
  const { usage, loading: usageLoading, refetch: refetchUsage } = useAIUsage();
  const { workspaceStorage, isLoading: storageLoading, refetch: refetchStorage } = useWorkspaceStorageSummary(!!workspaceId);
  const availableCredits = usage?.remainingCredits ?? 0;
  const availableStorageMb = bytesToWholeMb(workspaceStorage?.unassignedBytes ?? 0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [initialCredits, setInitialCredits] = useState(0);
  const [initialStorageMb, setInitialStorageMb] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [createdStudent, setCreatedStudent] = useState<CreatedStudent | null>(null);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    if (availableCredits < initialCredits) setInitialCredits(availableCredits);
  }, [availableCredits]);

  useEffect(() => {
    if (availableStorageMb < initialStorageMb) setInitialStorageMb(availableStorageMb);
  }, [availableStorageMb, initialStorageMb]);

  const getFormattedDetails = () => {
    if (!createdStudent) return "";
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    return [
      "Student login details – send this to the student securely",
      "",
      `Name: ${createdStudent.displayName}`,
      `Email: ${createdStudent.email}`,
      `Temporary password: ${createdStudent.password}`,
      "",
      `Login URL: ${baseUrl}/auth`,
      "",
      "They should sign in and change their password after first login.",
    ].join("\n");
  };

  const handleCopyDetails = async () => {
    const text = getFormattedDetails();
    if (!text) return;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Details copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    } finally {
      setCopying(false);
    }
  };

  const handleCreateAnother = () => {
    setCreatedStudent(null);
    setEmail("");
    setPassword("");
    setFirstName("");
    setLastName("");
    setInitialCredits(0);
    setInitialStorageMb(0);
  };

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
      if (initialStorageMb > 0) body.initialStorageMb = initialStorageMb;
      const res = await fetch("/api/tenant/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({})) as {
        message?: string;
        error?: string;
        creditsAssigned?: boolean;
        creditsError?: string;
        storageAssigned?: boolean;
        storageError?: string;
        userId?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? "Failed to create student account");
        if (data.error?.toLowerCase().includes("email")) setErrors({ email: data.error });
        return;
      }
      toast.success(data.message ?? "Student account created. Share the login details with them.");
      if (data.creditsAssigned === false && data.creditsError) {
        toast.warning(`Credits could not be assigned: ${data.creditsError}`);
      }
      if (data.storageAssigned === false && data.storageError) {
        toast.warning(`Storage could not be assigned: ${data.storageError}`);
      }
      void refetchUsage?.();
      void refetchStorage?.();
      const displayName = `${firstName.trim()} ${lastName.trim()}`;
      if (data.userId) {
        setCreatedStudent({
          userId: data.userId,
          email: email.trim().toLowerCase(),
          displayName,
          password,
        });
      } else {
        setEmail("");
        setPassword("");
        setFirstName("");
        setLastName("");
        setInitialCredits(0);
        setInitialStorageMb(0);
      }
    } catch {
      toast.error("Failed to create student account");
    } finally {
      setCreating(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 w-full max-w-3xl mx-auto">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/owner/students">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Students
          </Link>
        </Button>

        {createdStudent ? (
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm max-w-lg">
            <div className="p-6 pb-4">
              <div className="flex items-start gap-4">
                <span className="flex shrink-0 items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary">
                  <CheckCircle2 className="h-6 w-6" />
                </span>
                <div>
                  <h1 className="text-xl font-semibold tracking-tight text-foreground">Student created</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Share the login details below with the student securely (e.g. by email or in person).
                  </p>
                </div>
              </div>
            </div>

            <div className="mx-6 mb-6">
              <div className="rounded-xl border border-border bg-muted/40 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/80 bg-muted/60">
                  <KeyRound className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Student login details</span>
                </div>
                <div className="p-4 space-y-3">
                  <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Name</span>
                    <span className="text-sm font-medium text-foreground break-all">{createdStudent.displayName}</span>
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</span>
                    <span className="text-sm font-medium text-foreground break-all">{createdStudent.email}</span>
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Temporary password</span>
                    <span className="text-sm font-mono text-foreground break-all">{createdStudent.password}</span>
                  </div>
                  <div className="pt-2 border-t border-border/80">
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Login URL</span>
                    <a
                      href="/auth"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      {typeof window !== "undefined" ? window.location.origin : ""}/auth
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    </a>
                  </div>
                  <p className="text-xs text-muted-foreground pt-1">
                    They should sign in and change their password after first login.
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6 pt-0 flex flex-col sm:flex-row gap-3">
              <Button type="button" variant="default" onClick={handleCopyDetails} disabled={copying} className="w-full sm:max-w-[240px]">
                <Copy className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">{copying ? "Copied!" : "Copy all details"}</span>
              </Button>
              <Button type="button" variant="ghost" onClick={handleCreateAnother} className="text-muted-foreground border border-border w-full sm:max-w-[200px]">
                <span className="truncate">Create another student</span>
              </Button>
            </div>
          </div>
        ) : (
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <UserPlus className="h-8 w-8 text-primary" />
            <h1 className="text-xl font-bold">Create student account</h1>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Create an account for a student. They will use this email and password to sign in. Share the login details with them securely. They will have access under your workspace.
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
            <div>
              <div className="flex items-center justify-between mt-2">
                <Label htmlFor="initialStorageMb">Initial document storage (optional)</Label>
                <span className="text-sm text-muted-foreground">
                  {formatStorageSize(initialStorageMb * 1024 * 1024)} / {formatStorageSize(workspaceStorage?.unassignedBytes ?? 0)}
                </span>
              </div>
              <Slider
                id="initialStorageMb"
                min={0}
                max={availableStorageMb <= 0 ? 1 : availableStorageMb}
                step={getStorageSliderStepMb(availableStorageMb)}
                value={[initialStorageMb]}
                onValueChange={([value]) => setInitialStorageMb(Math.min(value, availableStorageMb))}
                disabled={storageLoading || availableStorageMb === 0}
                className="mt-2"
              />
              {availableStorageMb > 0 && (
                <div className="flex gap-0.5 mt-2" aria-hidden>
                  {Array.from({ length: 20 }).map((_, i) => {
                    const segmentThreshold = (i + 1) / 20;
                    const filled = initialStorageMb / availableStorageMb >= segmentThreshold;
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
              <p className="text-xs text-muted-foreground mt-1">
                Allocate document storage from your workspace pool to this student.
              </p>
            </div>
            <Button type="submit" disabled={creating}>
              {creating ? "Creating..." : "Create student account"}
            </Button>
          </form>
        </div>
        )}
      </div>
    </DashboardLayout>
  );
}
