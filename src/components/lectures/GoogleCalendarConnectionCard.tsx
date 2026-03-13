import { useEffect } from "react";
import { useRouter } from "next/router";
import { CalendarSync, Link as LinkIcon, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useGoogleCalendarConnection } from "@/hooks/useLectureSessions";

type GoogleCalendarConnectionCardProps = {
  redirectTo?: string;
  variant?: "teacher" | "student";
};

export function GoogleCalendarConnectionCard({
  redirectTo,
  variant = "teacher",
}: GoogleCalendarConnectionCardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { data, isLoading, beginConnect, disconnect, refetch } = useGoogleCalendarConnection();

  // After OAuth redirect: refetch connection and show toast so persisted state is correct
  useEffect(() => {
    const status = typeof router.query.googleCalendar === "string" ? router.query.googleCalendar : null;
    const message = typeof router.query.message === "string" ? router.query.message : null;
    if (!status) return;

    refetch();
    if (status === "connected") {
      toast({
        title: "Google Calendar connected",
        description: "Your calendar is linked. You can schedule lectures with Google Meet.",
      });
    } else if (status === "error") {
      toast({
        title: "Google Calendar connection failed",
        description: message ?? "Something went wrong. Try connecting again.",
        variant: "destructive",
      });
    }

    const { pathname, query } = router;
    const nextQuery = { ...query };
    delete nextQuery.googleCalendar;
    delete nextQuery.message;
    router.replace({ pathname, query: nextQuery }, undefined, { shallow: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only run when callback params appear
  }, [router.query.googleCalendar, router.query.message]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Google Calendar</CardTitle>
          <CardDescription>Checking Google Meet connection...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!data?.configured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Google Calendar</CardTitle>
          <CardDescription>
            Google Meet is not configured on the server yet. Session scheduling will stay unavailable until the OAuth keys are added.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarSync className="h-5 w-5 text-primary" />
          Google Calendar
        </CardTitle>
        <CardDescription>
          {variant === "student"
            ? "Connect your Google account to add tutoring sessions to your calendar and join meetings directly as an invitee—no one needs to admit you."
            : "Connect your Google account to create Google Meet links for classroom lectures."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          {data.connected ? (
            <>
              Connected as <span className="font-medium text-foreground">{data.email ?? "your Google account"}</span>.
            </>
          ) : (
            "You have not connected Google Calendar yet."
          )}
        </div>
        {data.connected ? (
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => disconnect.mutate()}
            disabled={disconnect.isPending}
          >
            <Unlink className="h-4 w-4" />
            {disconnect.isPending ? "Disconnecting..." : "Disconnect"}
          </Button>
        ) : (
          <Button className="gap-2" onClick={() => beginConnect(redirectTo)}>
            <LinkIcon className="h-4 w-4" />
            Connect Google
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
