import { useMemo } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowLeft,
  Users,
  School,
  ClipboardCheck,
  FileText,
  DollarSign,
  BookOpen,
  Pencil,
  Eye,
  BarChart3,
} from "lucide-react";
import { MemberCreditsCard } from "@/components/credits/MemberCreditsCard";
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
import { MemberStorageCard } from "@/components/storage/MemberStorageCard";
import { useLectureFinancialSummary } from "@/hooks/useLectureSessions";
import { LectureFinancialSummaryPanel } from "@/components/lectures/LectureFinancialSummaryPanel";

export default function OwnerTutorProfile() {
  const router = useRouter();
  const { id } = router.query;
  const tutorId = typeof id === "string" ? id : null;
  const { tutors, oneToOneRooms, classrooms, assignments, quizzes, contractByTutorId, tutorsByClassroomId, isLoading } = useOwnerWorkspace();

  const tutor = tutors.find((t) => t.user_id === tutorId);
  const contract = tutorId ? contractByTutorId.get(tutorId) : null;
  const { data: lectureFinancialSummary, isLoading: lectureFinancialLoading } =
    useLectureFinancialSummary({
      tutorId,
    });

  const tutor1v1Students = oneToOneRooms.filter((r) => r.tutor_id === tutorId).map((r) => ({ student_id: r.student_id, student: r.studentProfile }));
  const tutorClassrooms = classrooms.filter((c) => c.teacher_id === tutorId || (tutorsByClassroomId.get(c.id) ?? []).includes(tutorId ?? ""));
  const tutorClassroomIds = tutorClassrooms.map((c) => c.id);
  const { data: classroomEnrollments = [] } = useQuery({
    queryKey: ["tutor-classroom-enrollments", tutorClassroomIds],
    queryFn: async () => {
      if (tutorClassroomIds.length === 0) return [];
      const { data, error } = await supabase
        .from("enrollments")
        .select("student_id")
        .in("classroom_id", tutorClassroomIds)
        .eq("status", "active");
      if (error) throw error;
      return data ?? [];
    },
    enabled: tutorClassroomIds.length > 0,
  });
  const classroomStudentIds = useMemo(() => [...new Set((classroomEnrollments as { student_id: string }[]).map((e) => e.student_id))], [classroomEnrollments]);
  const { data: classroomStudentProfiles = [] } = useQuery({
    queryKey: ["profiles", classroomStudentIds],
    queryFn: async () => {
      if (classroomStudentIds.length === 0) return [];
      const { data, error } = await supabase.from("profiles").select("user_id, display_name, email").in("user_id", classroomStudentIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: classroomStudentIds.length > 0,
  });
  const profileMap = useMemo(() => new Map(classroomStudentProfiles.map((p) => [p.user_id, p])), [classroomStudentProfiles]);
  const assignedToThisTutor = useMemo(() => {
    const seen = new Set<string>();
    const out: { student_id: string; student?: { display_name: string | null; email?: string | null } | null }[] = [];
    for (const s of tutor1v1Students) {
      if (seen.has(s.student_id)) continue;
      seen.add(s.student_id);
      out.push({ student_id: s.student_id, student: s.student ?? null });
    }
    for (const e of classroomEnrollments as { student_id: string }[]) {
      if (seen.has(e.student_id)) continue;
      seen.add(e.student_id);
      const p = profileMap.get(e.student_id);
      out.push({ student_id: e.student_id, student: p ? { display_name: p.display_name ?? null, email: p.email ?? null } : null });
    }
    return out;
  }, [tutor1v1Students, classroomEnrollments, profileMap]);
  const tutorAssignments = assignments.filter((a) => a.teacher_id === tutorId);
  const tutorQuizzes = (quizzes as Array<{ teacher_id: string; created_at?: string }>).filter((q) => q.teacher_id === tutorId);

  const activityTimeline = useMemo(() => {
    const weeks: { week: string; weekStart: Date; assignments: number; quizzes: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const assignCount = tutorAssignments.filter((a) => {
        const created = a.created_at ? new Date(a.created_at) : null;
        return created && created >= weekStart && created < weekEnd;
      }).length;
      const quizCount = tutorQuizzes.filter((q) => {
        const created = q.created_at ? new Date(q.created_at) : null;
        return created && created >= weekStart && created < weekEnd;
      }).length;
      weeks.push({
        week: format(weekStart, "d MMM"),
        weekStart,
        assignments: assignCount,
        quizzes: quizCount,
      });
    }
    return weeks;
  }, [tutorAssignments, tutorQuizzes]);

  if (!tutorId && !router.isReady) return null;
  if (!isLoading && !tutor) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Button variant="ghost" asChild>
            <Link href="/dashboard/owner/tutors">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Tutors
            </Link>
          </Button>
          <p className="text-muted-foreground">Tutor not found.</p>
        </div>
      </DashboardLayout>
    );
  }

  const contractType = (contract as { contract_type?: string })?.contract_type ?? contract?.pay_type;
  const rateLabel = contract
    ? `${contract.rate_amount} ${contract.rate_currency}/${contractType === "per_session" ? "session" : contractType === "fixed_monthly" ? "month" : "hr"}`
    : "—";
  const subjectsLabel =
    contract?.subjects && Array.isArray(contract.subjects) && (contract.subjects as string[]).length > 0
      ? (contract.subjects as string[]).join(", ")
      : "—";

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/owner/tutors">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Tutors
          </Link>
        </Button>

        {/* Profile (left) + Contract (right) — same row */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="w-full rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-col items-center text-center">
              <Avatar className="h-14 w-14 rounded-full border-2 border-primary/10 bg-primary/5">
                <AvatarImage src={(tutor?.profile as { avatar_url?: string } | undefined)?.avatar_url} />
                <AvatarFallback className="text-primary text-lg font-semibold">
                  {(tutor?.profile?.display_name ?? "T")[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <h1 className="mt-3 text-xl font-bold tracking-tight">{tutor?.profile?.display_name ?? "Tutor"}</h1>
              <p className="text-sm text-muted-foreground">{tutor?.profile?.email ?? ""}</p>
              <span className="mt-1.5 inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                Tutor
              </span>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <DollarSign className="h-3.5 w-3.5 text-primary" />
                  {rateLabel}
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <BookOpen className="h-3.5 w-3.5 text-primary" />
                  {subjectsLabel}
                </span>
              </div>
            </div>
          </div>

          {contract && (
            <div className="w-full rounded-2xl border border-border bg-card p-6 shadow-sm">
             
              <div className="flex flex-col items-center justify-center text-center pr-10 h-full">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <h2 className="font-semibold">Contract</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {contract.contract_signed_at
                    ? `Signed on ${new Date(contract.contract_signed_at).toLocaleDateString()} by ${contract.tutor_signature_name ?? "—"}.`
                    : "View and manage this tutor's contract from the Contracts tab."}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  <Button variant="default" size="sm" className="px-4 py-2" asChild>
                    <Link href={`/dashboard/owner/contracts/${contract.id}`} title={contract.contract_body_text ? "View contract" : "Create contract"}>
                      <Eye className="h-4 w-4" /> View Contract
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" className="px-4 py-2" asChild>
                    <Link href={`/dashboard/owner/tutors/${tutorId}/payout`}>Payout</Link>
                  </Button>
                </div>
                {!contract.contract_body_text && (
                  <Button variant="outline" size="sm" className="mt-4 w-full sm:w-auto" asChild>
                    <Link href={`/dashboard/owner/contracts/new?tutorId=${tutorId}`}>Build AI contract</Link>
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Activity timeline — bar chart */}
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-muted/20 border-b border-border flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Activity timeline
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">Assignments and quizzes created in the last 6 weeks</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-sm bg-primary" aria-hidden /> Assignments
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" aria-hidden /> Quizzes
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
                        <p className="text-muted-foreground">Assignments: {(payload.find((p) => p.dataKey === "assignments")?.value as number) ?? 0}</p>
                        <p className="text-muted-foreground">Quizzes: {(payload.find((p) => p.dataKey === "quizzes")?.value as number) ?? 0}</p>
                      </div>
                    ) : null
                  }
                />
                <Bar dataKey="assignments" name="Assignments" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} maxBarSize={40} />
                <Bar dataKey="quizzes" name="Quizzes" fill="rgb(16, 185, 129)" radius={[2, 2, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Credits — full width with consumption chart */}
        {tutorId && (
          <div className="w-full">
            <MemberCreditsCard
              memberUserId={tutorId}
              memberLabel={tutor?.profile?.display_name ?? "Tutor"}
              variant="compact"
              showConsumptionChart
            />
          </div>
        )}

        {tutorId && (
          <div className="w-full">
            <MemberStorageCard
              memberUserId={tutorId}
              memberLabel={tutor?.profile?.display_name ?? "Tutor"}
              variant="compact"
            />
          </div>
        )}

        {tutorId && (
          <LectureFinancialSummaryPanel
            title="Mock lecture payroll and billing"
            description="Preview-only totals for this tutor, derived from completed lecture sessions and any session-level pricing overrides."
            summary={lectureFinancialSummary}
            isLoading={lectureFinancialLoading}
          />
        )}

        {/* Summary stat cards — three columns */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:bg-muted/30">
            <Users className="mb-3 h-5 w-5 text-muted-foreground" />
            <p className="text-3xl font-bold tabular-nums">{assignedToThisTutor.length}</p>
            <p className="text-sm text-muted-foreground">Assigned students</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:bg-muted/30">
            <School className="mb-3 h-5 w-5 text-muted-foreground" />
            <p className="text-3xl font-bold tabular-nums">{tutorClassrooms.length}</p>
            <p className="text-sm text-muted-foreground">Classrooms</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:bg-muted/30">
            <ClipboardCheck className="mb-3 h-5 w-5 text-muted-foreground" />
            <p className="text-3xl font-bold tabular-nums">{tutorAssignments.length}</p>
            <p className="text-sm text-muted-foreground">Assignments</p>
          </div>
        </div>

        {/* Assigned Students + Classrooms — two table cards */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-muted/20 border-b border-border">
              <h2 className="font-semibold text-foreground">Assigned Students</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Students linked to this tutor</p>
            </div>
            <div className="overflow-x-auto">
              {assignedToThisTutor.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                  No students assigned yet.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/80">
                      <th className="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Name</th>
                      <th className="px-6 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground w-20">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {assignedToThisTutor.map((s) => (
                      <tr key={s.student_id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-3.5">
                          <Link
                            href={`/dashboard/owner/students/${s.student_id}`}
                            className="font-medium text-foreground hover:text-primary transition-colors"
                          >
                            {s.student?.display_name ?? "Student"}
                          </Link>
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" asChild>
                            <Link href={`/dashboard/owner/students/${s.student_id}`} aria-label="View student">
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-muted/20 border-b border-border">
              <h2 className="font-semibold text-foreground">Classrooms</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Classes taught by this tutor</p>
            </div>
            <div className="overflow-x-auto">
              {tutorClassrooms.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-muted-foreground">No classrooms yet.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/80">
                      <th className="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Name</th>
                      <th className="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Subject</th>
                      <th className="px-6 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground w-20">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {tutorClassrooms.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-3.5 font-medium text-foreground">{c.name}</td>
                        <td className="px-6 py-3.5 text-muted-foreground">{c.subject ?? "—"}</td>
                        <td className="px-6 py-3.5 text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" asChild>
                            <Link href={`/dashboard/owner/classrooms/${c.id}`} aria-label="Edit classroom">
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
