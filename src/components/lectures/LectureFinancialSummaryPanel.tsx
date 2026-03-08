import { format } from "date-fns";
import {
  AlertTriangle,
  CircleDollarSign,
  Clock3,
  Users,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { MockFinancialSummary } from "@/hooks/useLectureSessions";

type LectureFinancialSummaryPanelProps = {
  title: string;
  description: string;
  summary?: MockFinancialSummary;
  isLoading?: boolean;
};

function formatCurrencyTotals(
  totals: Array<{ currency: string; amount: number }>,
  emptyLabel: string
) {
  if (!totals.length) return emptyLabel;
  return totals
    .map((item) => `${item.currency} ${item.amount.toFixed(2)}`)
    .join(" · ");
}

export function LectureFinancialSummaryPanel({
  title,
  description,
  summary,
  isLoading = false,
}: LectureFinancialSummaryPanelProps) {
  const recentCompleted = (summary?.lineItems ?? [])
    .filter((item) => item.status === "completed")
    .slice(0, 4);

  return (
    <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-primary/5 via-card to-card">
      <CardHeader className="border-b border-border/60 bg-muted/20">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <WalletCards className="h-5 w-5 text-primary" />
              {title}
            </CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
          <Badge variant="outline" className="gap-1.5 border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5" />
            Preview only
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((index) => (
              <div key={index} className="h-24 rounded-xl border bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border bg-card/80 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CircleDollarSign className="h-4 w-4 text-primary" />
                  <span className="text-sm">Mock payroll</span>
                </div>
                <p className="mt-3 text-lg font-semibold">
                  {formatCurrencyTotals(summary?.tutorPayrollByCurrency ?? [], "No payroll yet")}
                </p>
              </div>
              <div className="rounded-xl border bg-card/80 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <WalletCards className="h-4 w-4 text-primary" />
                  <span className="text-sm">Mock charges</span>
                </div>
                <p className="mt-3 text-lg font-semibold">
                  {formatCurrencyTotals(summary?.studentChargesByCurrency ?? [], "No charges yet")}
                </p>
              </div>
              <div className="rounded-xl border bg-card/80 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock3 className="h-4 w-4 text-primary" />
                  <span className="text-sm">Completed hours</span>
                </div>
                <p className="mt-3 text-lg font-semibold">
                  {(((summary?.completedDurationMinutes ?? 0) / 60) || 0).toFixed(1)} hrs
                </p>
              </div>
              <div className="rounded-xl border bg-card/80 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-sm">Completed sessions</span>
                </div>
                <p className="mt-3 text-lg font-semibold">
                  {summary?.completedSessions ?? 0}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {summary?.scheduledSessions ?? 0} still scheduled
                </p>
              </div>
            </div>

            <div className="rounded-xl border bg-card/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">Recent completed lecture previews</p>
                  <p className="text-sm text-muted-foreground">
                    Totals are derived from completed lectures and mock pricing inputs.
                  </p>
                </div>
              </div>
              {recentCompleted.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  No completed lecture previews yet.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {recentCompleted.map((item) => (
                    <div
                      key={item.sessionId}
                      className="flex flex-col gap-2 rounded-lg border border-border/70 bg-background/70 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(item.startsAt), "PPp")} · {item.scopeType === "one_to_one" ? "1:1" : "Classroom"} · {item.participantCount} attendee{item.participantCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="text-sm sm:text-right">
                        <p className="font-medium">
                          Payroll: {item.tutorPayrollCurrency} {item.tutorPayrollAmount.toFixed(2)}
                        </p>
                        <p className="text-muted-foreground">
                          Charges: {item.studentChargeCurrency} {item.studentChargeAmount.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
