import { CalendarSync, Link as LinkIcon, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useGoogleCalendarConnection } from "@/hooks/useLectureSessions";

type GoogleCalendarConnectionCardProps = {
  redirectTo?: string;
};

export function GoogleCalendarConnectionCard({
  redirectTo,
}: GoogleCalendarConnectionCardProps) {
  const { data, isLoading, beginConnect, disconnect } = useGoogleCalendarConnection();

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
          Connect your Google account to create Google Meet links for classroom lectures.
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
