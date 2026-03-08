import { useState, useEffect, useRef } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Save, AlertCircle, Camera } from "lucide-react";
import { CurrencySelect } from "@/components/ui/currency-select";
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
  const [logoUploading, setLogoUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const workspaceSettings: { default_currency?: string } = workspace?.settings ?? {};

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
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold">Workspace details</h1>
          <p className="text-muted-foreground mt-1">
            Edit your workspace name. It appears in the dashboard and in contract drafts.
          </p>
        </div>

        {isLoading && !workspace ? (
          <p className="text-muted-foreground">Loading workspace…</p>
        ) : !workspace ? (
          <p className="text-muted-foreground">No workspace found.</p>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Workspace
              </CardTitle>
              <CardDescription>
                Change the display name of your workspace. Tutors and students will see this in relevant places.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Logo section - same pattern as profile avatar */}
                <div className="flex items-center gap-6">
                  <div className="relative shrink-0">
                    <div className="h-20 w-20 rounded-xl border-2 border-primary/20 bg-muted flex items-center justify-center overflow-hidden">
                      {logoUrl ? (
                        <img src={logoUrl} alt="Workspace logo" className="h-full w-full object-contain" />
                      ) : (
                        <Building2 className="h-10 w-10 text-muted-foreground" />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleLogoSelect}
                      disabled={logoUploading}
                      className="absolute bottom-0 right-0 p-1.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Workspace logo</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Shown in the dashboard and contract drafts.
                    </p>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={handleLogoChange}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={handleLogoSelect}
                      disabled={logoUploading}
                    >
                      {logoUploading ? "Uploading…" : logoUrl ? "Change logo" : "Upload logo"}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      PNG, JPG, or WEBP. Max {LOGO_MAX_MB}MB.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="workspace-currency">Default currency</Label>
                  <p className="text-sm text-muted-foreground mb-1">
                    Used for new tutor contracts and rate display. You can override when creating a tutor.
                  </p>
                  <CurrencySelect
                    id="workspace-currency"
                    value={defaultCurrency}
                    onChange={handleCurrencyChange}
                    placeholder="Select currency"
                    className="max-w-[220px]"
                    disabled={currencySaving}
                  />
                  {currencySaving && (
                    <p className="text-xs text-muted-foreground">Saving…</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="workspace-name">Workspace name</Label>
                  <Input
                    id="workspace-name"
                    type="text"
                    placeholder="e.g. Acme Tutoring"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="max-w-md"
                  />
                  {error && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {error}
                    </p>
                  )}
                </div>
                <Button type="submit" disabled={isSubmitting}>
                  <Save className="w-4 h-4 mr-2" />
                  {isSubmitting ? "Saving…" : "Save changes"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
