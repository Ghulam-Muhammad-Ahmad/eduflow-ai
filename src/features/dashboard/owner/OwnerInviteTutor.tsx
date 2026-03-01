import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, UserPlus, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { passwordSchema } from "@/lib/validation";

export default function OwnerInviteTutor() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

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
      const res = await fetch("/api/tenant/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          role: "tutor",
        }),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed to create tutor account");
        if (data.error?.toLowerCase().includes("email")) setErrors({ email: data.error });
        return;
      }
      toast.success(data.message ?? "Tutor account created. Share the login details with them.");
      setEmail("");
      setPassword("");
      setFirstName("");
      setLastName("");
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
            <Button type="submit" disabled={creating}>
              {creating ? "Creating..." : "Create tutor account"}
            </Button>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
