import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  ClipboardCheck,
  Brain,
  Users,
  School,
  UserPlus,
  HelpCircle,
  Clock,
  CheckCircle2,
  BarChart3,
  TrendingUp,
  Loader2,
  FileCode,
  Link2,
  Calendar,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { useQuizzes, Quiz } from "@/hooks/useQuizzes";
import { useTutorOnboardingStats } from "@/hooks/useTutorOnboardingStats";
import { useTeacherDashboardStats } from "@/hooks/useTeacherDashboardStats";
import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";

const chartColors = {
  primary: "hsl(var(--primary))",
  primaryMuted: "hsl(var(--primary) / 0.2)",
  lime: "hsl(84 81% 44%)",
  limeMuted: "hsl(84 81% 44% / 0.2)",
  muted: "hsl(var(--muted-foreground))",
};

const TeacherDashboard = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { fetchTeacherQuizzes } = useQuizzes();
  const { classroomsCount, assignmentsCount, enrollmentsCount } = useTutorOnboardingStats();
  const { data: stats, isLoading: statsLoading } = useTeacherDashboardStats();
  const [recentQuizzes, setRecentQuizzes] = useState<Quiz[]>([]);
  const [quizzesLoading, setQuizzesLoading] = useState(false);

  const loadQuizzes = useCallback(async () => {
    if (!user?.id) return;
    setQuizzesLoading(true);
    try {
      const list = await fetchTeacherQuizzes(user.id);
      setRecentQuizzes(list?.slice(0, 5) ?? []);
    } catch {
      setRecentQuizzes([]);
    } finally {
      setQuizzesLoading(false);
    }
  }, [fetchTeacherQuizzes, user?.id]);

  useEffect(() => {
    loadQuizzes();
  }, [loadQuizzes]);

  const displayName = user?.user_metadata?.display_name ?? user?.email?.split("@")[0] ?? "Tutor";

  const tutorChecklistItems = [
    {
      label: "Create your first classroom",
      description: "Set up a class to organize students and materials.",
      done: classroomsCount >= 1,
      href: "/dashboard/teacher/classrooms",
      icon: School,
    },
    {
      label: "Invite or add a student to a class",
      description: "Add students to your classroom to assign work.",
      done: enrollmentsCount >= 1,
      href: "/dashboard/teacher/classrooms",
      icon: UserPlus,
    },
    {
      label: "Create your first assignment",
      description: "Create an assignment and share it with your class.",
      done: assignmentsCount >= 1,
      href: "/dashboard/teacher/assignments",
      icon: ClipboardCheck,
    },
  ];

  const getStatusVariant = (status: string) => {
    const v: Record<string, "live" | "neutral" | "default" | "secondary"> = {
      published: "live",
      draft: "secondary",
      archived: "neutral",
    };
    return v[status] ?? "default";
  };

  const formatDueDate = (due: string | null) => {
    if (!due) return "No due date";
    return `Due: ${new Date(due).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  };

  const formatQuizDate = (quiz: Quiz) => {
    if (quiz.available_until) {
      return `Due: ${new Date(quiz.available_until).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    }
    return "No due date";
  };

  const teacherQuizzes = recentQuizzes;

  const formatFileType = (fileType: string) => {
    if (!fileType) return "File";
    const mime = fileType.toLowerCase();
    if (mime.includes("pdf")) return "PDF";
    if (mime.includes("word") || mime.includes("document")) return "DOC";
    if (mime.includes("sheet") || mime.includes("excel")) return "Sheet";
    if (mime.includes("image") || mime.includes("png") || mime.includes("jpeg")) return "Image";
    const ext = fileType.split(".").pop()?.toUpperCase();
    return ext && ext.length <= 4 ? ext : "File";
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <OnboardingChecklist
          userName={displayName}
          instructionText="Complete all steps to get the most out of your tutor dashboard."
          items={tutorChecklistItems}
          hideWhenComplete
        />

        {/* Stats – 2 per row */}
        <section>
          <h2 className="sr-only">Overview</h2>
          <div className="grid grid-cols-2 gap-4">
            {statsLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-card rounded-xl border border-border shadow-sm p-5 flex items-center gap-3"
                >
                  <div className="w-12 h-12 rounded-xl bg-muted animate-pulse" />
                  <div className="flex-1">
                    <div className="h-7 w-14 bg-muted rounded animate-pulse mb-2" />
                    <div className="h-4 w-28 bg-muted rounded animate-pulse" />
                  </div>
                </div>
              ))
            ) : (
              <>
                <StatCard
                  icon={FileText}
                  label="Documents"
                  value={stats?.documentsCount ?? 0}
                  badge="Total"
                />
                <StatCard
                  icon={ClipboardCheck}
                  label="Active assignments"
                  value={stats?.pendingAssignmentsCount ?? 0}
                  badge="Published"
                />
                <StatCard
                  icon={Brain}
                  label="Papers graded"
                  value={stats?.papersGradedCount ?? 0}
                  badge="AI"
                />
                <StatCard
                  icon={Users}
                  label="Students"
                  value={stats?.studentsEnrolledCount ?? 0}
                  badge="Enrolled"
                />
              </>
            )}
          </div>
        </section>

        {/* Charts */}
        <section className="grid lg:grid-cols-2 gap-4">
          <div className="bg-card rounded-xl border border-border shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Weekly activity
              </h3>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="w-2 h-2 rounded-full bg-primary" /> Submissions
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="w-2 h-2 rounded-full bg-[hsl(84_81%_44%)]" /> Graded
                </span>
              </div>
            </div>
            {statsLoading ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats?.weeklyActivity ?? []} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    width={28}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Bar dataKey="submissions" fill={chartColors.primary} radius={[4, 4, 0, 0]} name="Submissions" />
                  <Bar dataKey="graded" fill={chartColors.lime} radius={[4, 4, 0, 0]} name="Graded" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-card rounded-xl border border-border shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Monthly engagement
              </h3>
              <span className="text-xs text-muted-foreground">Last 6 months</span>
            </div>
            {statsLoading ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={stats?.monthlyEngagement ?? []} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="engagementFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartColors.primary} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={chartColors.primary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    width={28}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value: number) => [value, "Engagement %"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="engagement"
                    stroke={chartColors.primary}
                    strokeWidth={2}
                    fill="url(#engagementFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* Two columns: Recent assignments + Grading progress & Quizzes */}
        <section className="grid lg:grid-cols-2 gap-4">
          <div className="bg-card rounded-xl border border-border shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Recent assignments</h3>
              <button
                type="button"
                onClick={() => router.push("/dashboard/teacher/assignments")}
                className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                aria-label="View all assignments"
              >
                <Link2 className="w-5 h-5" />
              </button>
            </div>
            {statsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : !stats?.recentAssignments?.length ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No assignments yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {stats.recentAssignments.map((a) => {
                  const submittedPct = a.students > 0 ? Math.round((a.submitted / a.students) * 100) : 0;
                  return (
                    <li
                      key={a.id}
                      className="group flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 hover:border-primary/30 cursor-pointer transition-all duration-200"
                      onClick={() => router.push(`/dashboard/teacher/assignments`)}
                    >
                      {/* <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                        <ClipboardCheck className="w-5 h-5 text-primary" />
                      </div> */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold text-foreground line-clamp-1">{a.title}</span>
                          <Badge variant={getStatusVariant(a.status)} className="shrink-0 text-[10px] capitalize">
                            {a.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Calendar className="w-3.5 h-3.5 shrink-0" />
                          <span>{formatDueDate(a.due_date).replace("Due: ", "")}</span>
                          {a.classroom_name && (
                            <>
                              <span className="text-border">·</span>
                              <span className="truncate">{a.classroom_name}</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Users className="w-3.5 h-3.5" />
                            <span>{a.students} enrolled</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                            <span>{a.submitted} submitted</span>
                          </span>
                          {a.students > 0 && (
                            <span className="text-[10px] font-medium text-primary tabular-nums">
                              {submittedPct}%
                            </span>
                          )}
                        </div>
                        {a.students > 0 && (
                          <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary/70 transition-all duration-300"
                              style={{ width: `${submittedPct}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="space-y-4">
            {/* Grading progress */}
            <div className="bg-card rounded-xl border border-border shadow-sm p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Grading progress</h3>
              {statsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-10 bg-muted/50 rounded animate-pulse" />
                  ))}
                </div>
              ) : !stats?.gradingProgress?.length ? (
                <p className="text-sm text-muted-foreground py-4">No submissions to grade yet.</p>
              ) : (
                <div className="space-y-4">
                  {stats.gradingProgress.map((item) => (
                    <div key={item.id}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-foreground truncate pr-2">{item.title}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {item.completed}/{item.total}
                        </span>
                      </div>
                      <Progress value={item.progress} variant="gradient" className="h-2" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent quizzes */}
            <div className="bg-card rounded-xl border border-border shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">Recent quizzes</h3>
                <button
                  type="button"
                  onClick={() => router.push("/dashboard/teacher/quizzes")}
                  className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                  aria-label="View all quizzes"
                >
                  <Link2 className="w-5 h-5" />
                </button>
              </div>
              {quizzesLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-14 bg-muted/50 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : !teacherQuizzes.length ? (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-3">No quizzes yet</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push("/dashboard/teacher/quizzes/create")}
                  >
                    <HelpCircle className="w-4 h-4 mr-2" />
                    Create quiz
                  </Button>
                </div>
              ) : (
                <ul className="space-y-3">
                  {teacherQuizzes.slice(0, 3).map((quiz) => (
                    <li
                      key={quiz.id}
                      className="pb-3 border-b border-border last:border-0 last:pb-0 cursor-pointer hover:bg-muted/30 -mx-2 px-2 py-2 rounded-lg transition-colors"
                      onClick={() => router.push(`/dashboard/teacher/quizzes/${quiz.id}/results`)}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-sm font-medium text-foreground line-clamp-1">{quiz.title}</span>
                        <Badge variant={quiz.status === "active" ? "live" : "neutral"} className="shrink-0 text-xs">
                          {quiz.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{formatQuizDate(quiz)}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {quiz.classroom?.name ?? "No classroom"}
                        </span>
                        {quiz.time_limit_minutes && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {quiz.time_limit_minutes} min
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* Recent documents – dynamic, compact */}
        {stats?.recentDocuments?.length ? (
          <section className="bg-card rounded-xl border border-border shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <FileCode className="w-4 h-4 text-primary" />
                Recent documents
              </h3>
              <button
                type="button"
                onClick={() => router.push("/dashboard/teacher/documents")}
                className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                aria-label="View all documents"
              >
                <Link2 className="w-5 h-5" />
              </button>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {stats.recentDocuments.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border hover:bg-muted/50 hover:border-primary/20 transition-colors text-sm text-foreground"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium truncate block">{doc.name}</span>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <Badge variant="secondary" className="font-normal text-[10px] px-1.5 py-0">
                        {formatFileType(doc.file_type)}
                      </Badge>
                      {doc.updated_at && (
                        <span>{new Date(doc.updated_at).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </DashboardLayout>
  );
};

function StatCard({
  icon: Icon,
  label,
  value,
  badge,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  badge: string;
}) {
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-5 hover:border-primary/20 hover:shadow-md transition-all duration-200">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-2xl font-bold tabular-nums text-foreground">{value}</div>
          <div className="text-xs text-muted-foreground truncate mt-0.5">{label}</div>
        </div>
        <Badge variant="neutral" className="shrink-0 text-xs">
          {badge}
        </Badge>
      </div>
    </div>
  );
}

export default TeacherDashboard;
