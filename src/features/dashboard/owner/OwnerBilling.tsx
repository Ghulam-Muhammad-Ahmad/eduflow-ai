import { useEffect, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { BillingPlans } from "@/components/billing/BillingPlans";
import {
  useWorkspaceSubscription,
  useUserSubscription,
  useBillingWorkspaceId,
} from "@/hooks/useSubscription";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ExternalLink, Coins } from "lucide-react";
import { useWorkspaceCredits } from "@/hooks/useWorkspaceCredits";

export default function OwnerBilling() {
  const [portalLoading, setPortalLoading] = useState(false);
  const workspaceId = useBillingWorkspaceId();
  const {
    subscription: workspaceSub,
    status: workspaceStatus,
    hasAccess: workspaceHasAccess,
    trialDaysLeft: workspaceTrialDaysLeft,
    periodDaysLeft: workspacePeriodDaysLeft,
    isLoading: workspaceLoading,
    invalidate: invalidateWorkspace,
  } = useWorkspaceSubscription(workspaceId);
  const {
    subscription: userSub,
    status: userStatus,
    hasAccess: userHasAccess,
    trialDaysLeft: userTrialDaysLeft,
    periodDaysLeft: userPeriodDaysLeft,
    isLoading: userLoading,
    invalidate: invalidateUser,
  } = useUserSubscription();

  const subscription = workspaceSub ?? userSub;
  const status = workspaceSub ? workspaceStatus : userStatus;
  const hasAccess = workspaceHasAccess || userHasAccess;
  const trialDaysLeft = workspaceSub ? workspaceTrialDaysLeft : userTrialDaysLeft;
  const periodDaysLeft = workspaceSub ? workspacePeriodDaysLeft : userPeriodDaysLeft;
  const isLoading = (workspaceId ? workspaceLoading : false) || userLoading;

  const { workspaceCredits, isLoading: creditsLoading } = useWorkspaceCredits(!!workspaceId);

  const invalidate = () => {
    invalidateWorkspace();
    invalidateUser();
  };

  useEffect(() => {
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount to refetch after return from Paddle
  }, []);

  const openManageSubscription = async () => {
    if (!workspaceId && !userSub) return;
    setPortalLoading(true);
    try {
      const qs = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";
      const res = await fetch(`/api/paddle/portal-session${qs}`, { credentials: "include" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Failed to open subscription management");
        return;
      }
      if (data.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
      }
    } catch {
      toast.error("Failed to open subscription management");
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Billing & Plan</h1>
          <p className="text-muted-foreground mt-1">
            Manage your workspace subscription. Business plans apply to all tutors and students in this workspace.
          </p>
        </div>

        {!isLoading && (
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Current plan</CardTitle>
              <CardDescription>
                {subscription ? (
                  <>
                    Status: <Badge variant={hasAccess ? "default" : "secondary"}>{status}</Badge>
                    {trialDaysLeft != null && trialDaysLeft > 0 && (
                      <span className="ml-2 text-sm">Trial: {trialDaysLeft} days left</span>
                    )}
                    {periodDaysLeft != null && (status === "active" || status === "trialing") && (
                      <span className="ml-2 text-sm">Renews in {periodDaysLeft} days</span>
                    )}
                  </>
                ) : (
                  "No active subscription. Choose a plan below to get started."
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {subscription && (
                <>
                  <p className="text-sm text-muted-foreground">
                    Cancel or update payment method in Paddle.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openManageSubscription}
                    disabled={portalLoading}
                  >
                    {portalLoading ? "Opening…" : "Manage subscription"}
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                </>
              )}
              {!subscription && (
                <p className="text-sm text-muted-foreground">
                  Every Basic plan includes a 14-day free trial. Select a plan to open checkout.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {workspaceId && (
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-muted-foreground" />
                Workspace AI credits
              </CardTitle>
              <CardDescription>
                Credits from your plan are shared by the workspace. You assign caps to tutors and students; all usage is deducted from this single pool.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {creditsLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : workspaceCredits ? (
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total from plan (this period)</span>
                    <span className="font-medium">{workspaceCredits.creditsAllocated}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Assigned to tutors/students</span>
                    <span>{workspaceCredits.creditsAssignedOut}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Used by you</span>
                    <span>{workspaceCredits.creditsUsedDirect}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Used by tutors/students</span>
                    <span>{workspaceCredits.creditsUsedByMembers}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 mt-2 font-medium">
                    <span>Remaining</span>
                    <span>{workspaceCredits.remaining}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No workspace credits data for this period.</p>
              )}
            </CardContent>
          </Card>
        )}

        <BillingPlans
          planLine="business"
          workspaceId={workspaceId}
          currentPriceId={subscription?.price_id ?? null}
          status={status}
        />
      </div>
    </DashboardLayout>
  );
}
