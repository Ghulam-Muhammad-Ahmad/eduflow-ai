import { useState, useEffect, useRef } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Save, AlertCircle, ImageIcon, Settings, Pencil } from "lucide-react";
import { CurrencySelect } from "@/components/ui/currency-select";
import { TimezoneSelect } from "@/components/ui/timezone-select";
import { resolveBrowserTimezone } from "@/lib/timezone";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const workspaceNameSchema = z
  .string()
  .min(1, "Workspace name is required")
  .max(100, "Workspace name must be at most 100 characters");

const LOGO_BUCKET = "workspace-logos";
const LOGO_MAX_MB = 2;
const LOGO_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function OwnerWorkspaceSettings() {
  const { user } = useAuth();
  const { workspace, invalidate, isLoading } = useOwnerWorkspace();
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [defaultCurrency, setDefaultCurrency] = useState("GBP");
  const [currencySaving, setCurrencySaving] = useState(false);
  const [defaultTimezone, setDefaultTimezone] = useState(() => resolveBrowserTimezone());
  const [timezoneSaving, setTimezoneSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const workspaceSettings: { default_currency?: string; default_timezone?: string } =
    workspace?.settings ?? {};

  useEffect(() => {
    if (workspace?.name != null) {
      setName(workspace.name);
    }
  }, [workspace?.name]);

  useEffect(() => {
    setLogoUrl(workspace?.logo_url ?? null);
  }, [workspace?.logo_url]);

  useEffect(() => {
    const c = workspaceSettings.default_currency;
    if (typeof c === "string" && c.trim()) setDefaultCurrency(c.trim());
  }, [workspaceSettings.default_currency]);

  useEffect(() => {
    const tz = workspaceSettings.default_timezone;
    if (typeof tz === "string" && tz.trim()) setDefaultTimezone(tz.trim());
  }, [workspaceSettings.default_timezone]);

  const handleTimezoneChange = async (value: string) => {
    setDefaultTimezone(value);
    if (!workspace?.id || !user?.id) return;
    setTimezoneSaving(true);
    try {
      // Merge so other settings keys are preserved.
      const nextSettings = { ...workspace?.settings, default_timezone: value };
      const { error: updateError } = await supabase
        .from("workspaces")
        .update({ settings: nextSettings, updated_at: new Date().toISOString() })
        .eq("id", workspace.id)
        .eq("owner_id", user.id);
      if (updateError) {
        toast.error(updateError.message);
        return;
      }
      invalidate();
      toast.success("Default timezone saved.");
    } catch (err) {
      toast.error((err as Error)?.message ?? "Failed to save timezone");
    } finally {
      setTimezoneSaving(false);
    }
  };

  const handleCurrencyChange = async (value: string) => {
    setDefaultCurrency(value);
    if (!workspace?.id || !user?.id) return;
    setCurrencySaving(true);
    try {
      // Persist to public.workspaces.settings (jsonb); merge so other keys are preserved
      const nextSettings = { ...workspace?.settings, default_currency: value };
      const { error: updateError } = await supabase
        .from("workspaces")
        .update({ settings: nextSettings, updated_at: new Date().toISOString() })
        .eq("id", workspace.id)
        .eq("owner_id", user.id);
      if (updateError) {
        toast.error(updateError.message);
        return;
      }
      invalidate();
      toast.success("Default currency saved.");
    } catch (err) {
      toast.error((err as Error)?.message ?? "Failed to save currency");
    } finally {
      setCurrencySaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = workspaceNameSchema.safeParse(name.trim());
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? "Invalid name");
      return;
    }
    if (!workspace?.id || !user?.id) {
      toast.error("Workspace not loaded.");
      return;
    }
    setIsSubmitting(true);
    try {
      const { error: updateError } = await supabase
        .from("workspaces")
        .update({ name: parsed.data, updated_at: new Date().toISOString() })
        .eq("id", workspace.id)
        .eq("owner_id", user.id);

      if (updateError) {
        toast.error(updateError.message);
        setError(updateError.message);
        return;
      }
      invalidate();
      toast.success("Workspace updated.");
    } catch (err) {
      const msg = (err as Error)?.message ?? "Failed to update workspace";
      toast.error(msg);
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogoSelect = () => {
    logoInputRef.current?.click();
  };

  const handleRemoveLogo = async () => {
    if (!workspace?.id || !user?.id) return;
    setLogoUploading(true);
    try {
      const { error: updateError } = await supabase
        .from("workspaces")
        .update({ logo_url: null, updated_at: new Date().toISOString() })
        .eq("id", workspace.id)
        .eq("owner_id", user.id);
      if (updateError) {
        toast.error(updateError.message);
        return;
      }
      setLogoUrl(null);
      invalidate();
      toast.success("Workspace logo removed.");
    } catch (err) {
      toast.error((err as Error)?.message ?? "Failed to remove logo.");
    } finally {
      setLogoUploading(false);
    }
  };

  const handleDiscard = () => {
    if (workspace?.name != null) setName(workspace.name);
    setError(null);
  };

  const handleLogoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !workspace?.id || !user?.id) return;

    if (!LOGO_ALLOWED_TYPES.includes(file.type)) {
      toast.error("Please upload a PNG, JPG, or WEBP image.");
      return;
    }
    if (file.size > LOGO_MAX_MB * 1024 * 1024) {
      toast.error(`Image must be smaller than ${LOGO_MAX_MB}MB.`);
      return;
    }

    setLogoUploading(true);
    try {
      const safeName = file.name.replace(/\s+/g, "-");
      const filePath = `${workspace.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from(LOGO_BUCKET)
        .upload(filePath, file, { upsert: true, contentType: file.type });

      if (uploadError) {
        toast.error(uploadError.message);
        return;
      }

      const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(filePath);
      const publicUrl = data.publicUrl;

      const { error: updateError } = await supabase
        .from("workspaces")
        .update({ logo_url: publicUrl, updated_at: new Date().toISOString() })
        .eq("id", workspace.id)
        .eq("owner_id", user.id);

      if (updateError) {
        toast.error(updateError.message);
        return;
      }

      setLogoUrl(publicUrl);
      invalidate();
      toast.success("Workspace logo updated!");
    } catch (err) {
      toast.error((err as Error)?.message ?? "Failed to upload logo.");
    } finally {
      setLogoUploading(false);
      event.target.value = "";
    }
  };

  return (
    <DashboardLayout>
      <div className="w-full space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Workspace details</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage your workspace core identity, branding assets, and default regional configurations for your team.
          </p>
        </div>

        {isLoading && !workspace ? (
          <p className="text-muted-foreground text-sm">Loading workspace…</p>
        ) : !workspace ? (
          <p className="text-muted-foreground text-sm">No workspace found.</p>
        ) : (
          <>
            {/* Workspace branding */}
            <Card className="border-border shadow-none rounded-lg">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-medium text-foreground">
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  Workspace branding
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1 min-w-0 flex-1">
                    <p className="font-medium text-foreground text-sm">Workspace logo</p>
                    <p className="text-sm text-muted-foreground">
                      Square image recommended. PNG, JPG or WEBP. Max {LOGO_MAX_MB}MB.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleLogoSelect}
                        disabled={logoUploading}
                      >
                        {logoUploading ? "Uploading…" : logoUrl ? "Change logo" : "Upload logo"}
                      </Button>
                      {logoUrl && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleRemoveLogo}
                          disabled={logoUploading}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="relative shrink-0">
                    <div className="h-20 w-20 rounded-lg border border-dashed border-border bg-muted/50 flex items-center justify-center overflow-hidden">
                      {logoUrl ? (
                        <img src={logoUrl} alt="Workspace logo" className="h-full w-full object-contain" />
                      ) : (
                        <Building2 className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleLogoSelect}
                      disabled={logoUploading}
                      className="absolute bottom-0 right-0 p-1 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
                      aria-label="Change logo"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleLogoChange}
                />
              </CardContent>
            </Card>

            {/* General settings */}
            <Card className="border-border shadow-none rounded-lg">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-medium text-foreground">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  General settings
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <form id="workspace-settings-form" onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="workspace-name" className="text-foreground text-sm">Workspace name</Label>
                    <Input
                      id="workspace-name"
                      type="text"
                      placeholder="e.g. Acme Tutoring"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="max-w-md h-9"
                    />
                    <p className="text-xs text-muted-foreground">
                      Visible to all members of the workspace.
                    </p>
                    {error && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {error}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5 flex flex-col gap-1">
                    <Label htmlFor="workspace-currency" className="text-foreground text-sm">Default currency</Label>
                    <CurrencySelect
                      id="workspace-currency"
                      value={defaultCurrency}
                      onChange={handleCurrencyChange}
                      placeholder="Select currency"
                      className="max-w-[400px]"
                      disabled={currencySaving}
                    />
                    <p className="text-xs text-muted-foreground">
                      Default for new invoices and projects.
                    </p>
                    {currencySaving && (
                      <p className="text-xs text-muted-foreground">Saving…</p>
                    )}
                  </div>
                  <div className="space-y-1.5 flex flex-col gap-1">
                    <Label className="text-foreground text-sm">Default timezone</Label>
                    <div className="max-w-[400px]">
                      <TimezoneSelect
                        value={defaultTimezone}
                        onChange={handleTimezoneChange}
                        disabled={timezoneSaving}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Pre-selected when scheduling a new session.
                    </p>
                    {timezoneSaving && (
                      <p className="text-xs text-muted-foreground">Saving…</p>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Footer actions */}
            <div className="flex flex-row items-center justify-between gap-3 pt-4 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDiscard}
              >
                Discard changes
              </Button>
              <Button
                type="submit"
                form="workspace-settings-form"
                size="sm"
                disabled={isSubmitting}
              >
                <Save className="w-4 h-4 mr-2" />
                {isSubmitting ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
