import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  Mail,
  Link as LinkIcon,
  Unlink,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useGoogleCalendarConnection } from "@/hooks/useLectureSessions";

const profileSchema = z.object({
  displayName: z.string().min(2, "Display name must be at least 2 characters").max(50),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const setPasswordSchema = z.object({
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const Settings = () => {
  const router = useRouter();
  const { user, role, profile, updateProfile, updatePassword, updateAvatar } = useAuth();
  const isOAuthUser = Boolean(user?.app_metadata?.provider);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});

  const { data: calendarData, isLoading: calendarLoading, beginConnect, disconnect, refetch } = useGoogleCalendarConnection();

  // Refetch calendar connection when returning from OAuth redirect
  useEffect(() => {
    const status = typeof router.query.googleCalendar === "string" ? router.query.googleCalendar : null;
    if (status) {
      refetch();
      const { pathname, query } = router;
      const nextQuery = { ...query };
      delete nextQuery.googleCalendar;
      delete nextQuery.message;
      router.replace({ pathname, query: nextQuery }, undefined, { shallow: true });
    }
  }, [router.query.googleCalendar]);

  useEffect(() => {
    const raw = profile?.display_name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "";
    const parts = (raw || "").trim().split(/\s+/);
    if (parts.length >= 2) {
      setFirstName(parts[0] || "");
      setLastName(parts.slice(1).join(" ") || "");
    } else {
      setFirstName(parts[0] || "");
      setLastName("");
    }
  }, [profile?.display_name, user?.user_metadata?.full_name, user?.user_metadata?.name, user?.email]);

  useEffect(() => {
    setAvatarUrl(profile?.avatar_url || null);
  }, [profile]);

  const displayName = profile?.display_name || user?.user_metadata?.display_name || user?.email?.split("@")[0] || "User";

  const handleAvatarSelect = () => {
    avatarInputRef.current?.click();
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Please upload a PNG, JPG, or WEBP image.");
      return;
    }

    const maxSizeMb = 15;
    if (file.size > maxSizeMb * 1024 * 1024) {
      toast.error(`Image must be smaller than ${maxSizeMb}MB.`);
      return;
    }

    setAvatarUploading(true);
    try {
      const safeName = file.name.replace(/\s+/g, "-");
      const filePath = `${user.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true, contentType: file.type });

      if (uploadError) {
        toast.error(uploadError.message);
        return;
      }

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const { error: profileError } = await updateAvatar(data.publicUrl);
      if (profileError) {
        toast.error(profileError.message);
        return;
      }

      setAvatarUrl(data.publicUrl);
      toast.success("Profile photo updated!");
    } catch (error) {
      toast.error((error as Error)?.message || "Failed to upload photo.");
    } finally {
      setAvatarUploading(false);
      event.target.value = "";
    }
  };

  const handleDeletePicture = async () => {
    if (!user) return;
    setAvatarUploading(true);
    try {
      const { error } = await updateAvatar("");
      if (error) {
        toast.error(error.message);
        return;
      }
      setAvatarUrl(null);
      toast.success("Profile picture removed.");
    } catch (error) {
      toast.error((error as Error)?.message || "Failed to remove picture.");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileErrors({});
    const displayNameValue = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ") || firstName.trim() || lastName.trim();
    if (!displayNameValue) {
      setProfileErrors({ displayName: "Enter at least a first or last name." });
      return;
    }
    setIsSubmitting(true);
    try {
      profileSchema.parse({ displayName: displayNameValue });
      const { error } = await updateProfile(displayNameValue);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Profile updated successfully!");
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        err.errors.forEach((er) => {
          if (er.path[0]) fieldErrors[er.path[0] as string] = er.message;
        });
        setProfileErrors(fieldErrors);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordErrors({});
    setIsSubmitting(true);
    try {
      if (isOAuthUser) {
        const validated = setPasswordSchema.parse({
          newPassword: passwordData.newPassword,
          confirmPassword: passwordData.confirmPassword,
        });
        const { error } = await updatePassword(validated.newPassword);
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success("Password set successfully! You can now sign in with email and password.");
        setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      } else {
        const validated = changePasswordSchema.parse(passwordData);
        const { error: verifyError } = await supabase.auth.signInWithPassword({
          email: user?.email || "",
          password: validated.currentPassword,
        });
        if (verifyError) {
          setPasswordErrors({ currentPassword: "Current password is incorrect" });
          setIsSubmitting(false);
          return;
        }
        const { error } = await updatePassword(validated.newPassword);
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success("Password updated successfully!");
        setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        err.errors.forEach((er) => {
          if (er.path[0]) fieldErrors[er.path[0] as string] = er.message;
        });
        setPasswordErrors(fieldErrors);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const showIntegrations = role === "teacher" || role === "admin" || role === "student";

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-0">
        {/* Account Header */}
        <div className="pb-6">
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage your account settings and preferences.
          </p>
        </div>

        <Separator className="my-6" />

        {/* Profile picture */}
        <section className="py-6">

          <div className="flex items-center justify-between gap-6 mt-4">
            <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 border-2 border-border rounded-full">
              <AvatarImage src={avatarUrl || ""} />
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold rounded-full">
                {displayName[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-base font-semibold text-foreground">Profile picture</h2>
              <p className="text-sm text-muted-foreground mt-0.5">PNG, JPEG under 15MB</p>
            </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAvatarSelect}
                disabled={avatarUploading}
              >
                <Upload className="h-4 w-4" />
                Upload new picture
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDeletePicture}
                disabled={avatarUploading}
              >
                Delete
              </Button>
            </div>
          </div>
        </section>

        <Separator className="my-6" />

        {/* Full name */}
        <section className="py-6">
          <h2 className="text-base font-semibold text-foreground">Full name</h2>
          <form onSubmit={handleProfileSubmit} className="mt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="border-input bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="border-input bg-background"
                />
              </div>
            </div>
            {profileErrors.displayName && (
              <p className="text-sm text-destructive">{profileErrors.displayName}</p>
            )}
            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </section>

        <Separator className="my-6" />

        <section className="py-6">
          <h2 className="text-base font-semibold text-foreground">Account Email</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your account&apos;s email address for receiving invoices.
          </p>
          <div className="mt-4 space-y-2">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
              <Input
                id="email"
                type="email"
                value={user?.email ?? ""}
                readOnly
                className="pl-10 border-input bg-muted/30"
              />
            </div>
          </div>
        </section>

        <Separator className="my-6" />

        {/* Password */}
        <section className="py-6">
          <h2 className="text-base font-semibold text-foreground">Password</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Modify your current password.
          </p>
          <form onSubmit={handlePasswordSubmit} className="mt-4 space-y-4">
            {!isOAuthUser && (
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData((p) => ({ ...p, currentPassword: e.target.value }))}
                    className="pl-10 pr-10 border-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {passwordErrors.currentPassword && (
                  <p className="text-sm text-destructive">{passwordErrors.currentPassword}</p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData((p) => ({ ...p, newPassword: e.target.value }))}
                  className="pl-10 pr-10 border-input"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {passwordErrors.newPassword && (
                <p className="text-sm text-destructive">{passwordErrors.newPassword}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData((p) => ({ ...p, confirmPassword: e.target.value }))}
                  className="pl-10 pr-10 border-input"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {passwordErrors.confirmPassword && (
                <p className="text-sm text-destructive">{passwordErrors.confirmPassword}</p>
              )}
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Updating..." : "Update password"}
              </Button>
            </div>
          </form>
        </section>

        {showIntegrations && (
          <>
            <Separator className="my-6" />
            {/* Integrated account */}
            <section className="py-6">
              <h2 className="text-base font-semibold text-foreground">Integrated Applications</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Manage your current integrated applications.
              </p>
              <div className="mt-4 space-y-3">
                {/* Google Calendar row */}
                {!calendarLoading && calendarData?.configured && (
                  <div className="flex items-center justify-between gap-4 p-4 rounded-lg border border-border bg-card">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted overflow-hidden">
                        <img src="/icons8-google-calendar-48.png" alt="" className="h-8 w-8 object-contain" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">Google Calendar</p>
                        <p className="text-sm text-muted-foreground truncate">
                          Connect your calendar for lectures and meetings.
                        </p>
                      </div>
                    </div>
                    {calendarData.connected ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="inline-flex items-center rounded-md bg-green-500 px-3 py-1.5 text-sm font-medium text-primary-foreground">
                          Connected
                        </span>
                        <Button variant="destructive" size="sm" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
                          <Unlink className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        className="shrink-0 gap-1.5"
                        onClick={() => beginConnect("/dashboard/settings")}
                      >
                        <LinkIcon className="h-4 w-4" />
                        Connect
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </section>
          </>
        )}

      </div>
    </DashboardLayout>
  );
};

export default Settings;
