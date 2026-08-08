import { useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import {
  useAssignEvaluation,
  useGenerateTeacherTest,
  useTeacherAiProfile,
  useReviewAiProfile,
} from "@/hooks/useTutorMatching";
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
  Brain,
  CheckCircle2,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { MemberCreditsCard } from "@/components/credits/MemberCreditsCard";
import DeleteAccountDialog from "@/features/dashboard/owner/components/DeleteAccountDialog";
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

const RECOMMENDATION_COLORS = {
  approved: "default" as const,
  needs_review: "secondary" as const,
  rejected: "destructive" as const,
};

function formatScoreKey(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? "bg-green-500" : value >= 50 ? "bg-yellow-500" : "bg-red-400";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export default function OwnerTutorProfile() {
  const router = useRouter();
  const { id } = router.query;
  const tutorId = typeof id === "string" ? id : null;
  const { tutors, oneToOneRooms, classrooms, assignments, quizzes, contractByTutorId, tutorsByClassroomId, isLoading } = useOwnerWorkspace();
  const { toast } = useToast();

  // Evaluation state
  const [evalForm, setEvalForm] = useState({
    subject: "",
    grades: "",
    curriculum: "",
    experience_years: "",
    language: "English",
  });
  const [reviewNotes, setReviewNotes] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const assignEval = useAssignEvaluation();
  const generateTest = useGenerateTeacherTest();
  const reviewProfile = useReviewAiProfile();
  const { data: aiProfile, refetch: refetchProfile } = useTeacherAiProfile(tutorId);

  const handleAssignEval = async () => {
    if (!tutorId || !evalForm.subject || !evalForm.grades || !evalForm.curriculum) {
      toast({ title: "Fill subject, grades, and curriculum", variant: "destructive" });
      return;
    }
    try {
      const { test } = await assignEval.mutateAsync({
        teacher_id: tutorId,
        subject: evalForm.subject,
        grades: evalForm.grades.split(",").map((s) => s.trim()).filter(Boolean),
        curriculum: evalForm.curriculum.split(",").map((s) => s.trim()).filter(Boolean),
        experience_years: evalForm.experience_years ? Number(evalForm.experience_years) : 0,
        language: evalForm.language || "English",
      });
      toast({ title: "Evaluation assigned. Generating questions…" });
      await generateTest.mutateAsync(test.id);
      toast({ title: "Questions generated. Tutor can now start the test." });
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handleReview = async (recommendation: string) => {
    if (!aiProfile || !tutorId) return;
    try {
      await reviewProfile.mutateAsync({
        profile_id: (aiProfile as { id: string }).id,
        teacher_id: tutorId,
        recommendation,
        owner_notes: reviewNotes,
      });
      toast({ title: `Marked as ${recommendation}` });
      await refetchProfile();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    }
  };

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
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" asChild>
            <Link href="/dashboard/owner/tutors">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Tutors
            </Link>
          </Button>
          {tutorId && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              Delete account
            </Button>
          )}
        </div>

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

        {/* AI Evaluation Section */}
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-muted/20 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                AI Tutor Evaluation
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Evaluate this tutor&apos;s skills, personality, and student fit
              </p>
            </div>
            {aiProfile && (
              <Badge variant={RECOMMENDATION_COLORS[(aiProfile as { recommendation?: keyof typeof RECOMMENDATION_COLORS }).recommendation ?? "needs_review"] ?? "secondary"}>
                {(aiProfile as { recommendation?: string }).recommendation?.replace("_", " ") ?? "needs review"}
              </Badge>
            )}
          </div>
          <div className="p-6">
            {!aiProfile ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Assign an evaluation test to this tutor. They will answer AI-generated questions, and the system will build a detailed score profile.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Subject *</Label>
                    <Input
                      value={evalForm.subject}
                      onChange={(e) => setEvalForm((f) => ({ ...f, subject: e.target.value }))}
                      placeholder="e.g. Math"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Grades (comma-separated) *</Label>
                    <Input
                      value={evalForm.grades}
                      onChange={(e) => setEvalForm((f) => ({ ...f, grades: e.target.value }))}
                      placeholder="e.g. Grade 6, Grade 7"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Curriculum (comma-separated) *</Label>
                    <Input
                      value={evalForm.curriculum}
                      onChange={(e) => setEvalForm((f) => ({ ...f, curriculum: e.target.value }))}
                      placeholder="e.g. Cambridge, IGCSE"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Experience (years)</Label>
                    <Input
                      type="number"
                      value={evalForm.experience_years}
                      onChange={(e) => setEvalForm((f) => ({ ...f, experience_years: e.target.value }))}
                      placeholder="e.g. 3"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Language</Label>
                    <Input
                      value={evalForm.language}
                      onChange={(e) => setEvalForm((f) => ({ ...f, language: e.target.value }))}
                      placeholder="English"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleAssignEval}
                  disabled={assignEval.isPending || generateTest.isPending}
                >
                  {(assignEval.isPending || generateTest.isPending) && (
                    <Spinner className="mr-2 h-4 w-4" />
                  )}
                  Assign & Generate Test
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Score summary */}
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-3xl font-bold tabular-nums">{(aiProfile as { overall_score?: number }).overall_score ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Overall Score / 100</p>
                  </div>
                  <Progress value={(aiProfile as { overall_score?: number }).overall_score ?? 0} className="flex-1 h-3" />
                </div>

                {/* Score categories */}
                {(["subject_scores", "teaching_style_scores", "personality_scores", "student_fit_scores"] as const).map((cat) => {
                  const scores = (aiProfile as Record<string, unknown>)[cat] as Record<string, number> | null;
                  if (!scores || Object.keys(scores).length === 0) return null;
                  const labels: Record<string, string> = {
                    subject_scores: "Subject Knowledge",
                    teaching_style_scores: "Teaching Style",
                    personality_scores: "Personality",
                    student_fit_scores: "Student Fit",
                  };
                  return (
                    <div key={cat} className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{labels[cat]}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {Object.entries(scores).map(([k, v]) => (
                          <ScoreBar key={k} label={formatScoreKey(k)} value={v} />
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* Best for */}
                {((aiProfile as { best_for?: string[] }).best_for ?? []).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Best For</p>
                    <div className="flex flex-wrap gap-2">
                      {((aiProfile as { best_for?: string[] }).best_for ?? []).map((b, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{b}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Summary */}
                {(aiProfile as { summary?: string }).summary && (
                  <p className="text-sm text-muted-foreground italic">
                    &ldquo;{(aiProfile as { summary?: string }).summary}&rdquo;
                  </p>
                )}

                {/* Owner review */}
                {!(aiProfile as { owner_reviewed?: boolean }).owner_reviewed && (
                  <div className="space-y-3 border-t pt-4">
                    <p className="text-sm font-medium">Review this evaluation</p>
                    <Textarea
                      placeholder="Optional notes for your records…"
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleReview("approved")}
                        disabled={reviewProfile.isPending}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReview("needs_review")}
                        disabled={reviewProfile.isPending}
                      >
                        Needs Review
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleReview("rejected")}
                        disabled={reviewProfile.isPending}
                      >
                        <AlertCircle className="w-4 h-4 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                )}

                {(aiProfile as { owner_reviewed?: boolean }).owner_reviewed && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground border-t pt-4">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Reviewed by owner
                    {(aiProfile as { owner_notes?: string }).owner_notes && (
                      <span>&mdash; {(aiProfile as { owner_notes?: string }).owner_notes}</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

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

      {tutorId && (
        <DeleteAccountDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          userId={tutorId}
          displayName={tutor?.profile?.display_name ?? "this tutor"}
          accountType="tutor"
          onDeleted={() => router.push("/dashboard/owner/tutors")}
        />
      )}
    </DashboardLayout>
  );
}
