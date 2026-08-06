import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format, isFuture } from "date-fns";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useStudentHasContent } from "@/hooks/useHasClassrooms";
import { useClassrooms } from "@/hooks/useClassrooms";
import { useOneToOneRooms } from "@/hooks/useOneToOneRooms";
import { useStudentAssignments } from "@/hooks/useAssignments";
import { useQuizzes, type Quiz, type QuizAttempt } from "@/hooks/useQuizzes";
import { useStudentAllLectureSessions } from "@/hooks/useLectureSessions";
import { computeStudentRecordAverages } from "@/lib/studentRecord";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Target,
  Trophy,
  Clock,
  TrendingUp,
  Video,
  UserPlus,
} from "lucide-react";

const StudentDashboard = () => {
  const { user } = useAuth();
  const { hasContent, isLoading: contentLoading } = useStudentHasContent();
  const isSelfStudy = !contentLoading && !hasContent;

  const { classrooms = [] } = useClassrooms();
  const { oneToOneRooms = [] } = useOneToOneRooms();
  const { data: assignments = [] } = useStudentAssignments();
  const { data: sessions = [] } = useStudentAllLectureSessions();
  const { fetchStudentQuizzes, fetchStudentAttempts } = useQuizzes();

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    fetchStudentQuizzes(user.id).then(setQuizzes);
    fetchStudentAttempts(user.id).then(setAttempts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const displayName =
    user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Student";

  const gradedAttempts = useMemo(
    () => attempts.filter((a) => a.status === "submitted" || a.status === "graded"),
    [attempts]
  );

  const averages = useMemo(
    () =>
      computeStudentRecordAverages(
        assignments
          .filter((a) => a.mySubmission)
          .map((a) => ({
            grade: a.mySubmission?.grade ?? null,
            points_possible: a.points_possible ?? null,
          })),
        gradedAttempts.map((a) => ({
          quiz_id: a.quiz_id,
          score: a.score ?? null,
          points_earned: a.points_earned ?? null,
          points_possible: a.points_possible ?? null,
        }))
      ),
    [assignments, gradedAttempts]
  );

  const upcomingAssignments = useMemo(
    () =>
      assignments
        .filter((a) => !a.mySubmission && a.due_date && isFuture(new Date(a.due_date)))
        .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
        .slice(0, 3),
    [assignments]
  );

  const completedCount = useMemo(
    () =>
      assignments.filter((a) => a.mySubmission?.status === "submitted" || a.mySubmission?.status === "graded")
        .length + gradedAttempts.length,
    [assignments, gradedAttempts]
  );

  const dueSoonCount = useMemo(
    () => assignments.filter((a) => !a.mySubmission && a.due_date && isFuture(new Date(a.due_date))).length,
    [assignments]
  );

  const upcomingSessions = useMemo(
    () =>
      sessions
        .filter((s) => s.status === "scheduled" && isFuture(new Date(s.starts_at)))
        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
        .slice(0, 3),
    [sessions]
  );

  const stats = [
    {
      icon: BookOpen,
      label: "Classes & Rooms",
      value: String(classrooms.length + oneToOneRooms.length),
      change: `${classrooms.length} class${classrooms.length === 1 ? "" : "es"} · ${oneToOneRooms.length} 1v1`,
      iconClass: "bg-primary/10 text-primary",
    },
    {
      icon: Target,
      label: "Assignments Due",
      value: String(dueSoonCount),
      change:
        upcomingAssignments[0]?.due_date
          ? `Next: ${format(new Date(upcomingAssignments[0].due_date), "MMM d")}`
          : "All caught up",
      iconClass: "bg-destructive/10 text-destructive",
    },
    {
      icon: Trophy,
      label: "Completed",
      value: String(completedCount),
      change: "Assignments & quizzes",
      iconClass: "bg-slime-lime/10 text-brand-lime-dark",
    },
    {
      icon: TrendingUp,
      label: "Overall Progress",
      value: averages.overallAvg != null ? `${Math.round(averages.overallAvg)}%` : "—",
      change: averages.overallAvg != null ? "Based on graded work" : "No grades yet",
      iconClass: "bg-primary/10 text-primary",
    },
  ];

  if (isSelfStudy) {
    return (
      <DashboardLayout>
        <div className="space-y-8">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
              Hello, {displayName}!
            </h1>
            <p className="text-muted-foreground mt-1">
              You&apos;re not in any class or 1v1 room yet. You&apos;ll see your classes and rooms here when your tutor or school adds you.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-4">
              <UserPlus className="h-10 w-10 text-muted-foreground" />
              <div>
                <h2 className="text-lg font-semibold text-foreground">Waiting to be added</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Your tutor or school will add you to a class or 1v1 room. Then you&apos;ll see assignments, quizzes, and materials here.
                </p>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
            Hello, {displayName}!
          </h1>
          <p className="text-muted-foreground mt-1">
            Keep up the great work! Here&apos;s your learning progress.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-card rounded-2xl border border-border p-6 hover:shadow-large hover:border-primary/20 transition-all duration-300"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${stat.iconClass}`}>
                  <stat.icon className="w-6 h-6" />
                </div>
              </div>
              <div className="text-3xl font-bold mb-1 text-foreground">{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
              <div className="text-xs text-brand-lime-dark mt-2 font-medium">{stat.change}</div>
            </div>
          ))}
        </div>

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Upcoming Assignments */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-foreground">
              <Clock className="w-5 h-5 text-muted-foreground" />
              Upcoming Assignments
            </h2>
            {upcomingAssignments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No assignments due right now.</p>
            ) : (
              <div className="space-y-4">
                {upcomingAssignments.map((assignment) => {
                  const dueDate = new Date(assignment.due_date!);
                  const urgent = dueDate.getTime() - Date.now() < 48 * 60 * 60 * 1000;
                  const courseName =
                    assignment.classrooms?.name ?? assignment.one_to_one_rooms?.name ?? "1v1 session";
                  return (
                    <div
                      key={assignment.id}
                      className={`p-4 rounded-xl border transition-all duration-200 ${
                        urgent
                          ? "border-destructive/30 bg-destructive/5 hover:border-destructive/50"
                          : "border-border bg-secondary/30 hover:border-primary/30"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-foreground">{assignment.title}</p>
                          <p className="text-sm text-muted-foreground">{courseName}</p>
                        </div>
                        <Badge variant={urgent ? "destructive" : "neutral"}>
                          {format(dueDate, "MMM d")}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upcoming Sessions */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-foreground">
              <Video className="w-5 h-5 text-primary" />
              Upcoming Sessions
            </h2>
            {upcomingSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No sessions scheduled yet.</p>
            ) : (
              <div className="space-y-4">
                {upcomingSessions.map((session) => (
                  <div
                    key={session.id}
                    className="p-4 rounded-xl bg-secondary/30 border border-border hover:border-primary/20 transition-all duration-200"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <p className="font-medium text-foreground">{session.title}</p>
                      <Badge variant="neutral">
                        {session.scope_type === "one_to_one" ? "1:1" : "Class"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(session.starts_at), "EEE, MMM d 'at' h:mm a")}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <Link
              href="/dashboard/student/sessions"
              className="inline-block mt-4 text-sm font-medium text-primary hover:underline"
            >
              View all sessions
            </Link>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentDashboard;
