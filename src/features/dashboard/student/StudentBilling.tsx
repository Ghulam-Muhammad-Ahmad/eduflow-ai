import { useEffect, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { BillingPlans } from "@/components/billing/BillingPlans";
import { useUserSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";

export default function StudentBilling() {
  const { user } = useAuth();
  const { subscription, status, hasAccess, trialDaysLeft, periodDaysLeft, isLoading, invalidate } =
    useUserSubscription();
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount to refetch after return from Paddle
  }, []);

  const openManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/paddle/portal-session", { credentials: "include" });
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
            Manage your student plan. Self-study plans include AI Study Coach, practice tests, and more.
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
                    {periodDaysLeft != null && status === "active" && (
                      <span className="ml-2 text-sm">Renews in {periodDaysLeft} days</span>
                    )}
                  </>
                ) : (
                  "No active subscription. Choose a plan below."
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
                  Student Basic includes a 14-day free trial. Select a plan to open checkout.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <BillingPlans
          planLine="student"
          userId={user?.id ?? null}
          currentPriceId={subscription?.price_id ?? null}
          status={status}
        />
      </div>
    </DashboardLayout>
  );
}
