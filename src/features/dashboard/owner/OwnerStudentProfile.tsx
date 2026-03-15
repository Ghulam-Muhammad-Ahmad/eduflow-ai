import { useMemo } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowLeft,
  User,
  Users,
  Video,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  CalendarClock,
  FileText,
  Plus,
  ChevronRight,
} from "lucide-react";
import { MemberCreditsCard } from "@/components/credits/MemberCreditsCard";
import { MemberStorageCard } from "@/components/storage/MemberStorageCard";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { format, startOfWeek, subWeeks } from "date-fns";
import { useStudentLectureSessions, useUpcomingStudentLectureSessions } from "@/hooks/useLectureSessions";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

type WorkspaceStudentRow = {
  student_id: string;
  student?: { display_name: string | null; email: string | null } | null;
};

type OneToOneRoomWithProfiles = {
  id: string;
  tutor_id: string;
  student_id: string;
  name: string | null;
  tutorProfile?: { display_name: string | null; email: string | null } | null;
  studentProfile?: { display_name: string | null; email: string | null } | null;
};

type EnrollmentRow = {
  classroom_id: string;
  classrooms: { id: string; name: string; subject: string | null } | null;
};

type QuizAttemptRow = {
  id: string;
  quiz_id: string;
  score: number | null;
  points_earned: number | null;
  points_possible: number | null;
  submitted_at: string | null;
  status: string;
  quizzes: { title: string } | null;
};

type SubmissionRow = {
  id: string;
  assignment_id: string;
  grade: number | null;
  submitted_at: string;
  status: string;
  assignments: { title: string; classroom_id: string } | null;
};

export default function OwnerStudentProfile() {
  const router = useRouter();
  const { id } = router.query;
  const studentId = typeof id === "string" ? id : null;
  const { assignedStudents, oneToOneRooms, tutors, isLoading } = useOwnerWorkspace();

  const workspaceStudent = (assignedStudents as WorkspaceStudentRow[]).find((s) => s.student_id === studentId);
  const student1v1Rooms = (oneToOneRooms as OneToOneRoomWithProfiles[]).filter((r) => r.student_id === studentId);

  const { data: enrollments = [] } = useQuery({
    queryKey: ["student-enrollments", studentId],
    queryFn: async (): Promise<EnrollmentRow[]> => {
      if (!studentId) return [];
      const { data, error } = await supabase
        .from("enrollments")
        .select("classroom_id, classrooms(id, name, subject)")
        .eq("student_id", studentId)
        .eq("status", "active");
      if (error) throw error;
      return (data ?? []) as EnrollmentRow[];
    },
    enabled: !!studentId,
  });

  const { data: allSessions = [] } = useStudentLectureSessions(studentId);
  const { data: upcomingSessions = [] } = useUpcomingStudentLectureSessions(studentId);

  const { data: quizAttempts = [] } = useQuery({
    queryKey: ["student-quiz-attempts", studentId],
    queryFn: async (): Promise<QuizAttemptRow[]> => {
      if (!studentId) return [];
      const { data, error } = await supabase
        .from("quiz_attempts")
        .select("id, quiz_id, score, points_earned, points_possible, submitted_at, status, quizzes(title)")
        .eq("student_id", studentId)
        .order("submitted_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as QuizAttemptRow[];
    },
    enabled: !!studentId,
  });

  const { data: submissions = [] } = useQuery({
    queryKey: ["student-submissions", studentId],
    queryFn: async (): Promise<SubmissionRow[]> => {
      if (!studentId) return [];
      const { data, error } = await supabase
        .from("submissions")
        .select("id, assignment_id, grade, submitted_at, status, assignments(title, classroom_id)")
        .eq("student_id", studentId)
        .order("submitted_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as SubmissionRow[];
    },
    enabled: !!studentId,
  });

  const activityTimeline = useMemo(() => {
    const weeks: { week: string; weekStart: Date; sessions: number; submissions: number; quizzes: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const sessionCount = allSessions.filter((s) => {
        const d = s.status === "completed" ? new Date(s.ends_at) : new Date(s.starts_at);
        return d >= weekStart && d < weekEnd;
      }).length;
      const subCount = submissions.filter((s) => {
        const d = new Date(s.submitted_at);
        return d >= weekStart && d < weekEnd;
      }).length;
      const quizCount = quizAttempts.filter((q) => {
        const d = q.submitted_at ? new Date(q.submitted_at) : null;
        return d && d >= weekStart && d < weekEnd;
      }).length;
      weeks.push({
        week: format(weekStart, "d MMM"),
        weekStart,
        sessions: sessionCount,
        submissions: subCount,
        quizzes: quizCount,
      });
    }
    return weeks;
  }, [allSessions, submissions, quizAttempts]);

  const completedSessions = useMemo(
    () => allSessions.filter((s) => s.status === "completed"),
    [allSessions]
  );

  if (!studentId && !router.isReady) return null;
  if (!isLoading && !workspaceStudent) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Button variant="ghost" asChild>
            <Link href="/dashboard/owner/students">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Students
            </Link>
          </Button>
          <p className="text-muted-foreground">Student not found in this workspace.</p>
        </div>
      </DashboardLayout>
    );
  }

  const displayName = workspaceStudent?.student?.display_name ?? "Student";
  const email = workspaceStudent?.student?.email ?? "";

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/owner/students">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Students
          </Link>
        </Button>

        {/* Profile (left) + 1v1 Rooms (right) — same row */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5 flex flex-col justify-center shadow-sm">
            <div className="flex flex-col items-center text-center">
              <Avatar className="h-14 w-14 rounded-full border-2 border-border bg-muted">
                <AvatarImage src={undefined} />
                <AvatarFallback className="text-lg font-semibold text-foreground">
                  {displayName[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <h2 className="mt-3 text-xl font-bold tracking-tight text-foreground">{displayName}</h2>
              <p className="text-sm text-muted-foreground">{email}</p>
              <span className="mt-1.5 inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                Student
              </span>
              {studentId && (
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/owner/students/${studentId}/billing-setup`}>
                      Billing setup
                    </Link>
                  </Button>
                  <Button variant="default" size="sm" className="bg-primary" asChild>
                    <Link href={`/dashboard/owner/students/${studentId}/billing`}>
                      Billing
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm flex flex-col justify-center min-h-[180px]">
            <div className="flex items-center justify-center gap-2 mb-3">
             
              <h2 className="text-sm font-semibold text-foreground tracking-tight">
                1v1 Rooms
              </h2>
            </div>
            {student1v1Rooms.length > 0 ? (
              <ul className="space-y-2">
                {student1v1Rooms.map((room) => {
                  const tutor = tutors.find((t) => t.user_id === room.tutor_id);
                  const roomLabel = room.name || (room.tutorProfile?.display_name ?? room.tutorProfile?.email ?? "1v1 room");
                  return (
                    <li key={room.id}>
                      <Link
                        href={`/dashboard/owner/rooms/${room.id}`}
                        className="flex items-center gap-3 rounded-lg border border-border/80 bg-muted/20 p-3 transition-colors hover:bg-muted/40 hover:border-primary/30 group"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background border border-border/60">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                          <span className="font-medium text-foreground block truncate">{roomLabel}</span>
                          {tutor && (
                            <span className="text-xs text-muted-foreground truncate block">
                              Tutor: {tutor.profile?.display_name ?? tutor.profile?.email}
                            </span>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center py-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-dashed border-border/80 bg-muted/30 mb-3">
                  <Users className="h-7 w-7 text-muted-foreground/70" />
                </div>
                <p className="text-sm text-muted-foreground mb-4 max-w-full">
                  This student isn’t in any 1v1 room yet. Add them to a room to enable one-to-one tutoring.
                </p>
                <Button asChild variant="default" size="sm" className="gap-2">
                  <Link href="/dashboard/owner/rooms">
                    <Plus className="h-4 w-4" />
                    Create 1v1 room
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Learning progress / Activity timeline — bar chart */}
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-muted/20 border-b border-border flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
                Learning progress
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">Sessions, submissions, and quiz attempts in the last 6 weeks</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-sm bg-primary" aria-hidden /> Sessions
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" aria-hidden /> Submissions
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" aria-hidden /> Quizzes
              </span>
            </div>
          </div>
          <div className="p-6">
            <ResponsiveContainer width="100%" height={260}>
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
                        <p className="text-muted-foreground">Sessions: {(payload.find((p) => p.dataKey === "sessions")?.value as number) ?? 0}</p>
                        <p className="text-muted-foreground">Submissions: {(payload.find((p) => p.dataKey === "submissions")?.value as number) ?? 0}</p>
                        <p className="text-muted-foreground">Quizzes: {(payload.find((p) => p.dataKey === "quizzes")?.value as number) ?? 0}</p>
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
        </div>

        {/* AI Credits — full width with consumption chart (like tutor) */}
        {studentId && (
          <div className="w-full">
            <MemberCreditsCard
              memberUserId={studentId}
              memberLabel={displayName}
              variant="compact"
              showConsumptionChart
            />
          </div>
        )}

        {studentId && (
          <div className="w-full">
            <MemberStorageCard
              memberUserId={studentId}
              memberLabel={displayName}
              variant="compact"
            />
          </div>
        )}

        {/* Summary stat cards — three columns (like tutor) */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:bg-muted/30">
            <Video className="mb-3 h-5 w-5 text-muted-foreground" />
            <p className="text-3xl font-bold tabular-nums text-foreground">{completedSessions.length}</p>
            <p className="text-sm text-muted-foreground">Sessions completed</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:bg-muted/30">
            <ClipboardCheck className="mb-3 h-5 w-5 text-muted-foreground" />
            <p className="text-3xl font-bold tabular-nums text-foreground">{submissions.length}</p>
            <p className="text-sm text-muted-foreground">Assignments submitted</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:bg-muted/30">
            <GraduationCap className="mb-3 h-5 w-5 text-muted-foreground" />
            <p className="text-3xl font-bold tabular-nums text-foreground">{quizAttempts.length}</p>
            <p className="text-sm text-muted-foreground">Quiz attempts</p>
          </div>
        </div>

        {/* Upcoming sessions + Student records (submissions & quiz attempts) — two columns */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-muted/20 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-foreground">Upcoming sessions</h2>
                <p className="text-xs text-muted-foreground mt-0.5">One-to-one sessions with tutor</p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/owner/sessions" className="text-muted-foreground hover:text-foreground">
                  View all
                </Link>
              </Button>
            </div>
            <div className="divide-y divide-border/60 max-h-[320px] overflow-y-auto">
              {upcomingSessions.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                  No upcoming sessions. Schedule from the Sessions page.
                </div>
              ) : (
                upcomingSessions.slice(0, 5).map((session) => (
                  <Link
                    key={session.id}
                    href="/dashboard/owner/sessions"
                    className="flex items-center gap-3 px-6 py-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Video className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">{session.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(session.starts_at), "EEE, d MMM · h:mm a")}
                      </p>
                    </div>
                    <Button variant="secondary" size="sm" className="shrink-0" asChild>
                      <Link href="/dashboard/owner/sessions">View</Link>
                    </Button>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-muted/20 border-b border-border">
              <h2 className="font-semibold text-foreground">Student records</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Recent submissions and quiz attempts</p>
            </div>
            <div className="max-h-[320px] overflow-y-auto">
              {submissions.length === 0 && quizAttempts.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                  No submissions or quiz attempts yet.
                </div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {submissions.slice(0, 5).map((s) => (
                    <li key={s.id} className="px-6 py-3 flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground truncate text-sm">{s.assignments?.title ?? "Assignment"}</p>
                        <p className="text-xs text-muted-foreground">
                          Submitted {format(new Date(s.submitted_at), "d MMM yyyy")}
                          {s.grade != null ? ` · Grade: ${s.grade}` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                  {quizAttempts.slice(0, 5).map((q) => (
                    <li key={q.id} className="px-6 py-3 flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <GraduationCap className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground truncate text-sm">{q.quizzes?.title ?? "Quiz"}</p>
                        <p className="text-xs text-muted-foreground">
                          {q.submitted_at ? format(new Date(q.submitted_at), "d MMM yyyy") : "In progress"}
                          {q.score != null ? ` · Score: ${q.score}%` : q.points_earned != null && q.points_possible != null ? ` · ${q.points_earned}/${q.points_possible} pts` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Enrolled classrooms — full width card (like tutor's Classrooms table) */}
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-muted/20 border-b border-border">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
              Enrolled classrooms
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Classes this student is enrolled in</p>
          </div>
          <div className="overflow-x-auto">
            {enrollments.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                Not enrolled in any classroom yet.
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {enrollments.map((e) => (
                  <li key={e.classroom_id}>
                    <Link
                      href={`/dashboard/owner/classrooms/${e.classroom_id}`}
                      className="flex items-center gap-3 px-6 py-3.5 hover:bg-muted/30 transition-colors"
                    >
                      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground">{e.classrooms?.name ?? "—"}</p>
                        {e.classrooms?.subject && (
                          <p className="text-sm text-muted-foreground">{e.classrooms.subject}</p>
                        )}
                      </div>
                      <span className="text-muted-foreground text-sm">View</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
