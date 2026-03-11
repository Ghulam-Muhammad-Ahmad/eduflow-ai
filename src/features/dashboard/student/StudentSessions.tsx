import { useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useClassrooms } from "@/hooks/useClassrooms";
import { useStudentAllLectureSessions } from "@/hooks/useLectureSessions";
import { SessionsTable } from "@/components/lectures/SessionsTable";
import { CalendarClock, Info, Search } from "lucide-react";

type SessionFilter = "active" | "completed" | "cancelled" | "all";

export default function StudentSessions() {
  const router = useRouter();
  const classroomIdFromQuery = typeof router.query.classroomId === "string" ? router.query.classroomId : null;
  const { classrooms } = useClassrooms();
  const { data: sessions = [], isLoading: sessionsLoading } = useStudentAllLectureSessions();

  const [sessionFilter, setSessionFilter] = useState<SessionFilter>("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [classroomFilter, setClassroomFilter] = useState<string>(classroomIdFromQuery ?? "all");

  const classroomMap = useMemo(
    () => new Map((classrooms ?? []).map((c) => [c.id, c.name])),
    [classrooms]
  );

  const orderedSessions = useMemo(
    () => [...sessions].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()),
    [sessions]
  );

  const visibleSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return orderedSessions.filter((session) => {
      const matchFilter =
        sessionFilter === "all"
          ? true
          : sessionFilter === "active"
            ? session.status === "scheduled"
            : session.status === sessionFilter;
      const matchClassroom =
        classroomFilter === "all" || session.classroom_id === classroomFilter;
      const matchSearch =
        !q ||
        `${session.title} ${session.description ?? ""}`.toLowerCase().includes(q);
      return matchFilter && matchClassroom && matchSearch;
    });
  }, [orderedSessions, sessionFilter, classroomFilter, searchQuery]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lecture sessions</h1>
          <p className="text-muted-foreground mt-1">
            View your scheduled classroom and one-to-one sessions. Join the Google Meet link when the session starts.
          </p>
        </div>

        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
          <Info className="h-5 w-5 shrink-0 text-primary mt-0.5" />
          <p className="text-sm text-foreground">
            You join meetings directly as an invitee—no one needs to admit you. Connect Google Calendar in{" "}
            <Link href="/dashboard/settings" className="font-medium text-primary underline underline-offset-2 hover:no-underline">
              Settings
            </Link>{" "}
            to add sessions to your calendar and get invite emails.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" />
              Sessions
            </CardTitle>
            <CardDescription>
              Filter by status or class. Click &quot;Join Meet&quot; when your session is live.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["active", "Scheduled"],
                    ["completed", "Completed"],
                    ["cancelled", "Cancelled"],
                    ["all", "All"],
                  ] as Array<[SessionFilter, string]>
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    variant={sessionFilter === value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSessionFilter(value)}
                  >
                    {label}
                  </Button>
                ))}
                <Select value={classroomFilter} onValueChange={setClassroomFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All classes</SelectItem>
                    {(classrooms ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="relative w-full lg:max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search sessions"
                  className="pl-9"
                />
              </div>
            </div>

            {sessionsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 rounded-lg border bg-secondary/30 animate-pulse" />
                ))}
              </div>
            ) : visibleSessions.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                {searchQuery.trim() || classroomFilter !== "all"
                  ? "No sessions match the current filters."
                  : "No lecture sessions scheduled yet. Your teacher will add sessions from their Sessions page."}
              </div>
            ) : (
              <SessionsTable sessions={visibleSessions} role="student" classroomMap={classroomMap} />
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
