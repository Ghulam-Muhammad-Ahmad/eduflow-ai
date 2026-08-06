import { useRouter } from "next/router";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowLeft,
  User,
  ClipboardList,
  ScrollText,
  ListTodo,
  BarChart3,
  Video,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import type { OneToOneRoomRow } from "@/hooks/useOneToOneRooms";

type AssignmentItem = {
  id: string;
  title: string;
  status: string;
  due_date?: string | null;
  points_possible?: number | null;
};

type QuizItem = {
  id: string;
  title: string;
  status: string;
};

export type OneToOneRoomDetailContentProps = {
  room: OneToOneRoomRow;
  backHref: string;
  title: string;
  subtitle: string;
  headerActions: React.ReactNode;
  assignments: AssignmentItem[];
  assignmentsLoading: boolean;
  quizzes: QuizItem[];
  quizzesLoading: boolean;
  viewRecordHref: string;
  /** Teacher: show sessions button and assignment/quiz create + row links. Owner: no sessions, optional links. */
  variant: "teacher" | "owner";
  /** Owner only: last 6 weeks for Activities graph */
  activityTimeline?: { week: string; sessions: number; submissions: number; quizzes: number }[];
  /** Owner only: session counts for Sessions analytics card */
  sessionsAnalytics?: { completed: number; scheduled: number };
  /**
   * Show the student's contact details. Defaults to false — only owner views opt in;
   * teachers must not see student contact info.
   */
  showContact?: boolean;
};

export default function OneToOneRoomDetailContent({
  room,
  backHref,
  title,
  subtitle,
  headerActions,
  assignments,
  assignmentsLoading,
  quizzes,
  quizzesLoading,
  viewRecordHref,
  variant,
  activityTimeline = [],
  sessionsAnalytics,
  showContact = false,
}: OneToOneRoomDetailContentProps) {
  const router = useRouter();
  const studentName = room.studentProfile?.display_name ?? "Student";
  const studentEmail = room.studentProfile?.email ?? "—";

  const teacherBase = "/dashboard/teacher";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push(backHref)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl lg:text-3xl font-bold">{title}</h1>
              <p className="text-muted-foreground mt-1">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">{headerActions}</div>
        </div>

        {/* Info Cards */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <User className="w-4 h-4" />
                Student
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">1</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ClipboardList className="w-4 h-4" />
                Assignments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{assignments?.length ?? 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ListTodo className="w-4 h-4" />
                Quizzes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{quizzes.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Owner only: Sessions analytics */}
        {variant === "owner" && sessionsAnalytics != null && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Video className="h-5 w-5 text-primary" />
                Sessions analytics
              </CardTitle>
              <CardDescription>Session counts for this 1v1 room</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-border/80 bg-muted/20 p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Video className="h-4 w-4" />
                    <span className="text-sm font-medium">Completed</span>
                  </div>
                  <p className="text-2xl font-bold tabular-nums text-foreground">{sessionsAnalytics.completed}</p>
                  <p className="text-xs text-muted-foreground">Sessions completed</p>
                </div>
                <div className="rounded-lg border border-border/80 bg-muted/20 p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm font-medium">Scheduled</span>
                  </div>
                  <p className="text-2xl font-bold tabular-nums text-foreground">{sessionsAnalytics.scheduled}</p>
                  <p className="text-xs text-muted-foreground">Upcoming sessions</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Owner only: Activities graph */}
        {variant === "owner" && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-2xl flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-primary" />
                Activities
              </CardTitle>
              <CardDescription>
                Sessions, submissions, and quiz attempts in the last 6 weeks
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {!activityTimeline?.length ? (
                <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/20">
                  <p className="text-sm text-muted-foreground">No activity data yet for this room.</p>
                </div>
              ) : (
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={activityTimeline} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" vertical={false} />
                      <XAxis
                        dataKey="week"
                        tick={{ fontSize: 12 }}
                        className="text-muted-foreground"
                        tickLine={false}
                        axisLine={{ stroke: "hsl(var(--border))" }}
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        className="text-muted-foreground"
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                        width={24}
                      />
                      <Tooltip
                        content={({ active, payload, label }) =>
                          active && payload?.length ? (
                            <div className="rounded-lg border border-border bg-card px-3 py-2.5 text-xs shadow-lg">
                              <p className="font-medium text-foreground mb-1.5">{label}</p>
                              <p className="text-muted-foreground">
                                Sessions: {(payload.find((p) => p.dataKey === "sessions")?.value as number) ?? 0}
                              </p>
                              <p className="text-muted-foreground">
                                Submissions: {(payload.find((p) => p.dataKey === "submissions")?.value as number) ?? 0}
                              </p>
                              <p className="text-muted-foreground">
                                Quizzes: {(payload.find((p) => p.dataKey === "quizzes")?.value as number) ?? 0}
                              </p>
                            </div>
                          ) : null
                        }
                      />
                      <Bar dataKey="sessions" name="Sessions" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} maxBarSize={36} />
                      <Bar dataKey="submissions" name="Submissions" fill="rgb(16, 185, 129)" radius={[2, 2, 0, 0]} maxBarSize={36} />
                      <Bar dataKey="quizzes" name="Quizzes" fill="rgb(59, 130, 246)" radius={[2, 2, 0, 0]} maxBarSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Student in this room */}
        <Card>
          <CardHeader>
            <CardTitle>Student in this room</CardTitle>
            <CardDescription>The student assigned to this 1v1 room.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/80 bg-muted/30">
                    <th className="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Student
                    </th>
                    {showContact && (
                      <th className="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Email
                      </th>
                    )}
                    <th className="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground hidden sm:table-cell">
                      Joined
                    </th>
                    <th className="px-6 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  <tr className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarImage src={room.studentProfile?.avatar_url ?? undefined} />
                          <AvatarFallback className="text-sm">
                            {(studentName[0] || "S").toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium truncate">{studentName}</span>
                      </div>
                    </td>
                    {showContact && (
                      <td className="px-6 py-3.5 text-muted-foreground truncate max-w-[200px]">
                        {studentEmail}
                      </td>
                    )}
                    <td className="px-6 py-3.5 text-muted-foreground text-xs hidden sm:table-cell">
                      {room.created_at ? new Date(room.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <Button variant="outline" size="sm" className="gap-1.5 shrink-0" asChild>
                        <Link href={viewRecordHref}>
                          <ScrollText className="w-4 h-4" />
                          View record
                        </Link>
                      </Button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Assignments for this room */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Assignments</CardTitle>
                <CardDescription>
                  Assignments for this 1v1 room.
                  {variant === "teacher" ? " Create from Assignments with this room selected." : ""}
                </CardDescription>
              </div>
              {variant === "teacher" && (
                <Button asChild size="sm" variant="outline">
                  <Link href={`${teacherBase}/assignments/new`}>New assignment</Link>
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {assignmentsLoading ? (
              <div className="space-y-2 py-4">
                <div className="h-10 bg-secondary/50 rounded animate-pulse" />
                <div className="h-10 bg-secondary/50 rounded animate-pulse" />
              </div>
            ) : !assignments?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                <ClipboardList className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No assignments yet.{variant === "teacher" ? " Create one from Assignments and select this 1v1 room." : ""}</p>
                {variant === "teacher" && (
                  <Button asChild variant="link" className="mt-2">
                    <Link href={`${teacherBase}/assignments/new`}>Create assignment</Link>
                  </Button>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {assignments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div>
                      <p className="font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.status} · {a.points_possible ?? 100} pts
                        {a.due_date && ` · Due ${format(new Date(a.due_date), "MMM d, yyyy")}`}
                      </p>
                    </div>
                    {variant === "teacher" && (
                      <div className="flex items-center gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`${teacherBase}/assignments/${a.id}`}>View</Link>
                        </Button>
                        {a.status === "published" && (
                          <Button asChild variant="outline" size="sm">
                            <Link href={`${teacherBase}/assignments/${a.id}/submissions`}>
                              Submissions
                            </Link>
                          </Button>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Quizzes for this room */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Quizzes</CardTitle>
                <CardDescription>
                  Quizzes for this 1v1 room.
                  {variant === "teacher" ? " Create from Quizzes with this room selected." : ""}
                </CardDescription>
              </div>
              {variant === "teacher" && (
                <Button asChild size="sm" variant="outline">
                  <Link href={`${teacherBase}/quizzes/create`}>New quiz</Link>
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {quizzesLoading ? (
              <div className="space-y-2 py-4">
                <div className="h-10 bg-secondary/50 rounded animate-pulse" />
                <div className="h-10 bg-secondary/50 rounded animate-pulse" />
              </div>
            ) : quizzes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ListTodo className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No quizzes yet.{variant === "teacher" ? " Create one from Quizzes and select this 1v1 room." : ""}</p>
                {variant === "teacher" && (
                  <Button asChild variant="link" className="mt-2">
                    <Link href={`${teacherBase}/quizzes/create`}>Create quiz</Link>
                  </Button>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {quizzes.map((q) => (
                  <li key={q.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div>
                      <p className="font-medium">{q.title}</p>
                      <p className="text-xs text-muted-foreground">{q.status}</p>
                    </div>
                    {variant === "teacher" && (
                      <div className="flex items-center gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`${teacherBase}/quizzes/${q.id}/edit`}>Edit</Link>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`${teacherBase}/quizzes/${q.id}/results`}>Results</Link>
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
