import { useState, useEffect } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Save, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const workspaceNameSchema = z
  .string()
  .min(1, "Workspace name is required")
  .max(100, "Workspace name must be at most 100 characters");

export default function OwnerWorkspaceSettings() {
  const { user } = useAuth();
  const { workspace, invalidate, isLoading } = useOwnerWorkspace();
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (workspace?.name != null) {
      setName(workspace.name);
    }
  }, [workspace?.name]);

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
              <form onSubmit={handleSubmit} className="space-y-4">
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
