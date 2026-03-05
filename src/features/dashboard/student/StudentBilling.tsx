import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function StudentBilling() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Billing</h1>
          <p className="text-muted-foreground mt-1">
            Your access is included with your school or tutor. No separate plan is required.
          </p>
        </div>

        <Card className="border-border">
          <CardHeader>
            <CardTitle>Included with workspace</CardTitle>
            <CardDescription>
              You have access through your tutor or school. They manage billing; you can focus on learning.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              If you have questions about your access, contact your tutor or workspace owner.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
