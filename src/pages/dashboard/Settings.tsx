import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Camera,
  Shield,
  Bell,
  Palette,
  Save,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const profileSchema = z.object({
  displayName: z.string().min(2, "Display name must be at least 2 characters").max(50),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const emailSchema = z.object({
  newEmail: z.string().email("Please enter a valid email address"),
});

type SettingsTab = "profile" | "security" | "notifications" | "appearance";

const Settings = () => {
  const { user, role, updateProfile, updatePassword, updateEmail } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Profile form state
  const [profileData, setProfileData] = useState({
    displayName: "",
  });
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});

  // Password form state
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});

  // Email form state
  const [emailData, setEmailData] = useState({
    newEmail: "",
  });
  const [emailErrors, setEmailErrors] = useState<Record<string, string>>({});

  // Load user data
  useEffect(() => {
    if (user) {
      setProfileData({
        displayName: user.user_metadata?.display_name || "",
      });
    }
  }, [user]);

  const displayName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "User";

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileErrors({});
    setIsSubmitting(true);

    try {
      const validated = profileSchema.parse(profileData);
      const { error } = await updateProfile(validated.displayName);

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Profile updated successfully!");
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
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
      const validated = passwordSchema.parse(passwordData);
      
      // First verify current password by trying to sign in
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
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setPasswordErrors(fieldErrors);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailErrors({});
    setIsSubmitting(true);

    try {
      const validated = emailSchema.parse(emailData);
      const { error } = await updateEmail(validated.newEmail);

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Verification email sent! Please check your new email inbox.");
      setEmailData({ newEmail: "" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setEmailErrors(fieldErrors);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabs = [
    { id: "profile" as const, label: "Profile", icon: User },
    { id: "security" as const, label: "Security", icon: Shield },
    { id: "notifications" as const, label: "Notifications", icon: Bell },
    { id: "appearance" as const, label: "Appearance", icon: Palette },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Account Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your account settings and preferences
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Navigation */}
          <div className="lg:w-64 shrink-0">
            <Card className="p-2">
              <nav className="space-y-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                        activeTab === tab.id
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </Card>
          </div>

          {/* Main Content */}
          <div className="flex-1 space-y-6">
            {/* Profile Tab */}
            {activeTab === "profile" && (
              <>
                {/* Profile Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Profile Information</CardTitle>
                    <CardDescription>
                      Update your profile details and personal information
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* Avatar Section */}
                    <div className="flex items-center gap-6 mb-6">
                      <div className="relative">
                        <Avatar className="h-20 w-20 border-4 border-primary/20">
                          <AvatarImage src="" />
                          <AvatarFallback className="bg-primary/10 text-primary text-2xl font-semibold">
                            {displayName[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <button className="absolute bottom-0 right-0 p-1.5 rounded-full bg-primary text-white hover:bg-primary/90 transition-colors">
                          <Camera className="w-4 h-4" />
                        </button>
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg text-foreground">{displayName}</h3>
                        <p className="text-muted-foreground text-sm">{user?.email}</p>
                        <Badge variant="secondary" className="mt-2 capitalize">
                          {role}
                        </Badge>
                      </div>
                    </div>

                    <Separator className="my-6" />

                    {/* Profile Form */}
                    <form onSubmit={handleProfileSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="displayName">Display Name</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                          <Input
                            id="displayName"
                            type="text"
                            placeholder="Enter your display name"
                            className="pl-10"
                            value={profileData.displayName}
                            onChange={(e) =>
                              setProfileData({ ...profileData, displayName: e.target.value })
                            }
                          />
                        </div>
                        {profileErrors.displayName && (
                          <p className="text-sm text-destructive flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" />
                            {profileErrors.displayName}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>Email Address</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                          <Input
                            type="email"
                            className="pl-10 bg-secondary/50"
                            value={user?.email || ""}
                            disabled
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          To change your email, go to the Security tab
                        </p>
                      </div>

                      <div className="flex justify-end pt-4">
                        <Button type="submit" disabled={isSubmitting}>
                          <Save className="w-4 h-4 mr-2" />
                          {isSubmitting ? "Saving..." : "Save Changes"}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Security Tab */}
            {activeTab === "security" && (
              <>
                {/* Change Password Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lock className="w-5 h-5" />
                      Change Password
                    </CardTitle>
                    <CardDescription>
                      Update your password to keep your account secure
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handlePasswordSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="currentPassword">Current Password</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                          <Input
                            id="currentPassword"
                            type={showCurrentPassword ? "text" : "password"}
                            placeholder="Enter current password"
                            className="pl-10 pr-10"
                            value={passwordData.currentPassword}
                            onChange={(e) =>
                              setPasswordData({ ...passwordData, currentPassword: e.target.value })
                            }
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                        {passwordErrors.currentPassword && (
                          <p className="text-sm text-destructive flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" />
                            {passwordErrors.currentPassword}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="newPassword">New Password</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                          <Input
                            id="newPassword"
                            type={showNewPassword ? "text" : "password"}
                            placeholder="Enter new password"
                            className="pl-10 pr-10"
                            value={passwordData.newPassword}
                            onChange={(e) =>
                              setPasswordData({ ...passwordData, newPassword: e.target.value })
                            }
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                        {passwordErrors.newPassword && (
                          <p className="text-sm text-destructive flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" />
                            {passwordErrors.newPassword}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirm New Password</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                          <Input
                            id="confirmPassword"
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Confirm new password"
                            className="pl-10 pr-10"
                            value={passwordData.confirmPassword}
                            onChange={(e) =>
                              setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                            }
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                        {passwordErrors.confirmPassword && (
                          <p className="text-sm text-destructive flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" />
                            {passwordErrors.confirmPassword}
                          </p>
                        )}
                      </div>

                      <div className="flex justify-end pt-4">
                        <Button type="submit" disabled={isSubmitting}>
                          <Shield className="w-4 h-4 mr-2" />
                          {isSubmitting ? "Updating..." : "Update Password"}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>

                {/* Change Email Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="w-5 h-5" />
                      Change Email Address
                    </CardTitle>
                    <CardDescription>
                      Update your email address. A verification email will be sent to your new address.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-primary mt-0.5" />
                        <div>
                          <p className="font-medium text-foreground">Current Email</p>
                          <p className="text-sm text-muted-foreground">{user?.email}</p>
                        </div>
                      </div>
                    </div>

                    <form onSubmit={handleEmailSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="newEmail">New Email Address</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                          <Input
                            id="newEmail"
                            type="email"
                            placeholder="Enter new email address"
                            className="pl-10"
                            value={emailData.newEmail}
                            onChange={(e) =>
                              setEmailData({ ...emailData, newEmail: e.target.value })
                            }
                          />
                        </div>
                        {emailErrors.newEmail && (
                          <p className="text-sm text-destructive flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" />
                            {emailErrors.newEmail}
                          </p>
                        )}
                      </div>

                      <div className="flex justify-end pt-4">
                        <Button type="submit" disabled={isSubmitting}>
                          <Mail className="w-4 h-4 mr-2" />
                          {isSubmitting ? "Sending..." : "Send Verification"}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Notifications Tab */}
            {activeTab === "notifications" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    Notification Preferences
                  </CardTitle>
                  <CardDescription>
                    Manage how you receive notifications
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50">
                      <div>
                        <p className="font-medium text-foreground">Email Notifications</p>
                        <p className="text-sm text-muted-foreground">
                          Receive email notifications for important updates
                        </p>
                      </div>
                      <Button variant="outline" size="sm">
                        Configure
                      </Button>
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50">
                      <div>
                        <p className="font-medium text-foreground">Assignment Reminders</p>
                        <p className="text-sm text-muted-foreground">
                          Get notified about upcoming assignment deadlines
                        </p>
                      </div>
                      <Button variant="outline" size="sm">
                        Configure
                      </Button>
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50">
                      <div>
                        <p className="font-medium text-foreground">Grade Updates</p>
                        <p className="text-sm text-muted-foreground">
                          Be notified when grades are posted
                        </p>
                      </div>
                      <Button variant="outline" size="sm">
                        Configure
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-6 text-center">
                    More notification settings coming soon
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Appearance Tab */}
            {activeTab === "appearance" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="w-5 h-5" />
                    Appearance Settings
                  </CardTitle>
                  <CardDescription>
                    Customize how the application looks
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50">
                      <div>
                        <p className="font-medium text-foreground">Theme</p>
                        <p className="text-sm text-muted-foreground">
                          Choose your preferred color scheme
                        </p>
                      </div>
                      <Badge variant="secondary">Dark Mode</Badge>
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50">
                      <div>
                        <p className="font-medium text-foreground">Compact Mode</p>
                        <p className="text-sm text-muted-foreground">
                          Use a more condensed layout
                        </p>
                      </div>
                      <Button variant="outline" size="sm">
                        Toggle
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-6 text-center">
                    More appearance settings coming soon
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
