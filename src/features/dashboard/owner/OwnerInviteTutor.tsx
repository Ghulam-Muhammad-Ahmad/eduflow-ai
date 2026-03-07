import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useAIUsage } from "@/hooks/useAIUsage";
import { ArrowLeft, UserPlus, Eye, EyeOff, Copy, FileText, CheckCircle2, KeyRound, ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { passwordSchema } from "@/lib/validation";

type CreatedTutor = {
  userId: string;
  email: string;
  displayName: string;
  password: string;
};

export default function OwnerInviteTutor() {
  const { usage, loading: usageLoading, refetch: refetchUsage } = useAIUsage();
  const availableCredits = usage?.remainingCredits ?? 0;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [payType, setPayType] = useState<"hourly" | "per_session">("hourly");
  const [rateAmount, setRateAmount] = useState("");
  const [rateCurrency, setRateCurrency] = useState("GBP");
  const [subjects, setSubjects] = useState("");
  const [initialCredits, setInitialCredits] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [createdTutor, setCreatedTutor] = useState<CreatedTutor | null>(null);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    if (availableCredits < initialCredits) setInitialCredits(availableCredits);
  }, [availableCredits]);

  const getFormattedDetails = () => {
    if (!createdTutor) return "";
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    return [
      "Tutor login details – send this to the tutor securely",
      "",
      `Name: ${createdTutor.displayName}`,
      `Email: ${createdTutor.email}`,
      `Temporary password: ${createdTutor.password}`,
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
    setCreatedTutor(null);
    setEmail("");
    setPassword("");
    setFirstName("");
    setLastName("");
    setRateAmount("");
    setSubjects("");
    setInitialCredits(0);
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
        role: "tutor",
        payType,
        rateAmount: rateAmount === "" ? 0 : parseFloat(rateAmount) || 0,
        rateCurrency: rateCurrency.trim() || "GBP",
        subjects: subjects
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter(Boolean),
      };
      if (initialCredits > 0) body.initialCredits = initialCredits;
      const res = await fetch("/api/tenant/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({})) as { message?: string; error?: string; creditsAssigned?: boolean; creditsError?: string; userId?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Failed to create tutor account");
        if (data.error?.toLowerCase().includes("email")) setErrors({ email: data.error });
        return;
      }
      toast.success(data.message ?? "Tutor account created. Share the login details with them.");
      if (data.creditsAssigned === false && data.creditsError) {
        toast.warning(`Credits could not be assigned: ${data.creditsError}`);
      }
      void refetchUsage?.();
      if (data.userId) {
        setCreatedTutor({
          userId: data.userId,
          email: email.trim().toLowerCase(),
          displayName: `${firstName.trim()} ${lastName.trim()}`,
          password,
        });
      } else {
        setEmail("");
        setPassword("");
        setFirstName("");
        setLastName("");
        setRateAmount("");
        setSubjects("");
        setInitialCredits(0);
      }
    } catch {
      toast.error("Failed to create tutor account");
    } finally {
      setCreating(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-md">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/owner/tutors">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Tutors
          </Link>
        </Button>

        {createdTutor ? (
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm max-w-lg">
            {/* Success header */}
            <div className="p-6 pb-4">
              <div className="flex items-start gap-4">
                <span className="flex shrink-0 items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary">
                  <CheckCircle2 className="h-6 w-6" />
                </span>
                <div>
                  <h1 className="text-xl font-semibold tracking-tight text-foreground">Tutor created</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Share the login details below with the tutor securely (e.g. by email or in person).
                  </p>
                </div>
              </div>
            </div>

            {/* Login details block */}
            <div className="mx-6 mb-6">
              <div className="rounded-xl border border-border bg-muted/40 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/80 bg-muted/60">
                  <KeyRound className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Tutor login details</span>
                </div>
                <div className="p-4 space-y-3">
                  <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Name</span>
                    <span className="text-sm font-medium text-foreground break-all">{createdTutor.displayName}</span>
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</span>
                    <span className="text-sm font-medium text-foreground break-all">{createdTutor.email}</span>
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Temporary password</span>
                    <span className="text-sm font-mono text-foreground break-all">{createdTutor.password}</span>
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

            {/* Actions */}
            <div className="px-6 pb-6 pt-0 grid grid-cols-2 gap-3">
              <Button type="button" variant="default" onClick={handleCopyDetails} disabled={copying} className="w-full">
                <Copy className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">{copying ? "Copied!" : "Copy all details"}</span>
              </Button>
              <Button variant="outline" asChild className="w-full">
                <Link href={`/dashboard/owner/contracts/new?tutorId=${createdTutor.userId}`} className="flex items-center justify-center">
                  <FileText className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">Create AI contract</span>
                </Link>
              </Button>
              <Button type="button" variant="ghost" onClick={handleCreateAnother} className="text-muted-foreground border border-border w-full">
                <span className="truncate">Create another tutor</span>
              </Button>
            </div>
          </div>
        ) : (
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <UserPlus className="h-8 w-8 text-primary" />
            <h1 className="text-xl font-bold">Create tutor account</h1>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Create an account for a tutor. They will use this email and password to sign in. Share the login details with them securely (in person or your own email).
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="Jane"
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
                  placeholder="Doe"
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
                placeholder="tutor@example.com"
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="payType">Pay type</Label>
                <Select value={payType} onValueChange={(v) => setPayType(v as "hourly" | "per_session")}>
                  <SelectTrigger id="payType" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="per_session">Per session</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="rateAmount">Rate amount</Label>
                <Input
                  id="rateAmount"
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0"
                  value={rateAmount}
                  onChange={(e) => setRateAmount(e.target.value)}
                  className="mt-2"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="rateCurrency">Currency</Label>
              <Input
                id="rateCurrency"
                type="text"
                placeholder="GBP"
                value={rateCurrency}
                onChange={(e) => setRateCurrency(e.target.value)}
                className="mt-2 max-w-[120px]"
              />
            </div>
            <div>
              <Label htmlFor="subjects">Subjects (comma-separated)</Label>
              <Input
                id="subjects"
                type="text"
                placeholder="Math, English, Science"
                value={subjects}
                onChange={(e) => setSubjects(e.target.value)}
                className="mt-2"
              />
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
              {/* Segment bar: filled = assigned, muted = available */}
              {availableCredits > 0 && (
              <div className="flex gap-0.5 mt-2" aria-hidden>
                {Array.from({ length: 20 }).map((_, i) => {
                  const segmentThreshold = (i + 1) / 20;
                  const filled = initialCredits / availableCredits >= segmentThreshold;
                  return (
                    <div
                      key={i}
                      className={`flex-1 min-w-[4px] rounded-sm transition-colors ${
                        filled ? "bg-primary" : "bg-muted"
                      }`}
                      style={{ height: 8 }}
                    />
                  );
                })}
              </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Deduct from workspace pool and assign to this tutor.</p>
            </div>
            <Button type="submit" disabled={creating}>
              {creating ? "Creating..." : "Create tutor account"}
            </Button>
          </form>
        </div>
        )}
      </div>
    </DashboardLayout>
  );
}
