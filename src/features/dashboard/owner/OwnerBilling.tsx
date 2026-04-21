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
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ExternalLink, Coins, HardDrive, Check } from "lucide-react";
import { useWorkspaceCredits } from "@/hooks/useWorkspaceCredits";
import { useWorkspaceStorageSummary } from "@/hooks/useStorage";
import { formatStorageSize } from "@/lib/storage-quota";

export default function OwnerBilling() {
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
  const { workspaceStorage, isLoading: storageLoading } = useWorkspaceStorageSummary(!!workspaceId);

  const invalidate = () => {
    invalidateWorkspace();
    invalidateUser();
  };

  useEffect(() => {
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

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
          <div className={workspaceId ? "grid grid-cols-1 gap-4 md:grid-cols-3" : "space-y-4"}>
            {/* Card 1: Active plan */}
            <Card className="border-border flex flex-col">
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <Badge variant="secondary" className="w-fit text-xs">
                  ACTIVE PLAN
                </Badge>
                {subscription && hasAccess && (
                  <span className="rounded-full border border-border bg-muted/50 p-1">
                    <Check className="h-4 w-4 text-muted-foreground" />
                  </span>
                )}
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3 pt-0">
                <CardTitle className="text-lg">Current plan</CardTitle>
                <CardDescription className="text-sm">
                  {subscription ? (
                    <>
                      Status: <Badge variant={hasAccess ? "default" : "secondary"}>{status}</Badge>
                      {trialDaysLeft != null && trialDaysLeft > 0 && (
                        <span className="ml-2">Trial: {trialDaysLeft} days left</span>
                      )}
                      {periodDaysLeft != null && (status === "active" || status === "trialing") && (
                        <span className="ml-2">Renews in {periodDaysLeft} days</span>
                      )}
                    </>
                  ) : (
                    "No active subscription. Choose a plan below to get started."
                  )}
                </CardDescription>
                {!subscription && (
                  <p className="text-sm text-muted-foreground">
                    Select a plan below to get started with your workspace.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Card 2: AI credits */}
            {workspaceId && (
              <Card className="border-border flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <Coins className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">Workspace AI credits</CardTitle>
                  <CardDescription className="text-sm">
                    Credits from your plan are shared by the workspace. You assign caps to tutors and students; all usage is deducted from this single pool.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-2 pt-0">
                  {creditsLoading ? (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                  ) : workspaceCredits ? (
                    <>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-2xl font-semibold tabular-nums">
                          {Math.max(0, workspaceCredits.creditsAllocated - workspaceCredits.remaining)} / {workspaceCredits.creditsAllocated.toLocaleString()}
                        </span>
                        {workspaceCredits.creditsAllocated > 0 && (
                          <span className="text-sm text-muted-foreground">
                            {Math.round((100 * (workspaceCredits.creditsAllocated - workspaceCredits.remaining)) / workspaceCredits.creditsAllocated)}% used
                          </span>
                        )}
                      </div>
                      <Progress
                        value={workspaceCredits.creditsAllocated > 0 ? (100 * (workspaceCredits.creditsAllocated - workspaceCredits.remaining)) / workspaceCredits.creditsAllocated : 0}
                        className="h-2"
                      />
                      {periodDaysLeft != null && (status === "active" || status === "trialing") && (
                        <p className="text-xs text-muted-foreground">Resets in {periodDaysLeft} days</p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No workspace credits data for this period.</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Card 3: Workspace storage */}
            {workspaceId && (
              <Card className="border-border flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <HardDrive className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">Workspace document storage</CardTitle>
                  <CardDescription className="text-sm">
                    Storage from your plan is shared by the workspace. Assign storage limits to tutors and students from this single pool.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-2 pt-0">
                  {storageLoading ? (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                  ) : workspaceStorage ? (
                    <>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-2xl font-semibold tabular-nums">
                          {formatStorageSize(workspaceStorage.usedBytes)} / {formatStorageSize(workspaceStorage.totalLimitBytes)}
                        </span>
                        {workspaceStorage.totalLimitBytes > 0 && (
                          <span className="text-sm text-muted-foreground">
                            {Math.round((100 * workspaceStorage.usedBytes) / workspaceStorage.totalLimitBytes)}% used
                          </span>
                        )}
                      </div>
                      <Progress
                        value={workspaceStorage.totalLimitBytes > 0 ? (100 * workspaceStorage.usedBytes) / workspaceStorage.totalLimitBytes : 0}
                        className="h-2"
                        variant="success"
                      />
                      <p className="text-xs text-muted-foreground">Across all team projects</p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No workspace storage data available.</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
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
