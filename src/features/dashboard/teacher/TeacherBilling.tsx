import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useWorkspaceSubscription, useBillingWorkspaceId } from "@/hooks/useSubscription";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function TeacherBilling() {
  const workspaceId = useBillingWorkspaceId();
  const { subscription, status, hasAccess, trialDaysLeft, periodDaysLeft, isLoading } =
    useWorkspaceSubscription(workspaceId);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Billing & Plan</h1>
          <p className="text-muted-foreground mt-1">
            Your subscription is managed by your workspace owner. Contact them for billing or plan changes.
          </p>
        </div>

        {!isLoading && subscription && (
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Current plan</CardTitle>
              <CardDescription>
                Status: <Badge variant={hasAccess ? "default" : "secondary"}>{status}</Badge>
                {trialDaysLeft != null && trialDaysLeft > 0 && (
                  <span className="ml-2 text-sm">Trial: {trialDaysLeft} days left</span>
                )}
                {periodDaysLeft != null && status === "active" && (
                  <span className="ml-2 text-sm">Renews in {periodDaysLeft} days</span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Your workspace owner manages this subscription. To change plan or payment, contact them.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
