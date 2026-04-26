import { useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  useWorkspaceEvaluations,
  useAssignEvaluation,
  useGenerateTeacherTest,
  useReviewAiProfile,
  type TutorEvaluationRow,
} from "@/hooks/useTutorMatching";
import {
  Brain,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Users,
} from "lucide-react";

// ─── Config ───────────────────────────────────────────────────────────────────

const RECOMMENDATION_CONFIG = {
  approved: { label: "Approved", variant: "default" as const, color: "text-green-600" },
  needs_review: { label: "Needs Review", variant: "secondary" as const, color: "text-yellow-600" },
  rejected: { label: "Rejected", variant: "destructive" as const, color: "text-red-600" },
};

const STATUS_CONFIG = {
  pending: { label: "Test Ready", variant: "secondary" as const, icon: ClipboardList },
  in_progress: { label: "In Progress", variant: "secondary" as const, icon: Clock },
  completed: { label: "Awaiting AI", variant: "secondary" as const, icon: Clock },
  evaluated: { label: "Evaluated", variant: "default" as const, icon: CheckCircle2 },
};

const SCORE_CATEGORIES = [
  { key: "subject_scores", label: "Subject Knowledge" },
  { key: "teaching_style_scores", label: "Teaching Style" },
  { key: "personality_scores", label: "Personality" },
  { key: "student_fit_scores", label: "Student Fit" },
] as const;

function formatKey(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Assign form dialog ───────────────────────────────────────────────────────

interface AssignDialogProps {
  tutor: TutorEvaluationRow;
  open: boolean;
  onClose: () => void;
}

const DEFAULT_ASSIGN = { subject: "", grades: "", curriculum: "", experience_years: "", language: "English" };

function AssignDialog({ tutor, open, onClose }: AssignDialogProps) {
  const [form, setForm] = useState(DEFAULT_ASSIGN);
  const assignEval = useAssignEvaluation();
  const generateTest = useGenerateTeacherTest();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleAssign = async () => {
    if (!form.subject || !form.grades || !form.curriculum) {
      toast({ title: "Subject, grades, and curriculum required", variant: "destructive" });
      return;
    }
    try {
      const { test } = await assignEval.mutateAsync({
        teacher_id: tutor.teacher_id,
        subject: form.subject,
        grades: form.grades.split(",").map((s) => s.trim()).filter(Boolean),
        curriculum: form.curriculum.split(",").map((s) => s.trim()).filter(Boolean),
        experience_years: form.experience_years ? Number(form.experience_years) : 0,
        language: form.language || "English",
      });
      toast({ title: "Evaluation assigned. Generating questions…" });
      await generateTest.mutateAsync(test.id);
      toast({ title: "Questions generated. Tutor can now start the test." });
      queryClient.invalidateQueries({ queryKey: ["workspace-evaluations"] });
      setForm(DEFAULT_ASSIGN);
      onClose();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    }
  };

  const busy = assignEval.isPending || generateTest.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Assign Evaluation — {tutor.profile.display_name ?? "Tutor"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <Label>Subject *</Label>
              <Input
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="e.g. Math"
              />
            </div>
            <div className="space-y-1">
              <Label>Grades (comma-separated) *</Label>
              <Input
                value={form.grades}
                onChange={(e) => setForm((f) => ({ ...f, grades: e.target.value }))}
                placeholder="e.g. Grade 6, Grade 7"
              />
            </div>
            <div className="space-y-1">
              <Label>Curriculum *</Label>
              <Input
                value={form.curriculum}
                onChange={(e) => setForm((f) => ({ ...f, curriculum: e.target.value }))}
                placeholder="e.g. Cambridge"
              />
            </div>
            <div className="space-y-1">
              <Label>Experience (years)</Label>
              <Input
                type="number"
                value={form.experience_years}
                onChange={(e) => setForm((f) => ({ ...f, experience_years: e.target.value }))}
                placeholder="e.g. 3"
              />
            </div>
            <div className="space-y-1">
              <Label>Language</Label>
              <Input
                value={form.language}
                onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
                placeholder="English"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={handleAssign} disabled={busy}>
            {busy && <Spinner className="mr-2 h-4 w-4" />}
            Assign & Generate Test
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Score breakdown ──────────────────────────────────────────────────────────

function ScoreBreakdown({ profileId }: { profileId: string }) {
  // Fetch full profile details for breakdown
  const [fullProfile, setFullProfile] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    if (fullProfile) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/owner/teacher-ai-profile-full?profile_id=${profileId}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json() as { profile: Record<string, unknown> };
      setFullProfile(data.profile);
    } catch {
      toast({ title: "Failed to load details", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Load on mount
  if (!fullProfile && !loading) { void load(); }

  if (loading) return <div className="flex justify-center py-4"><Spinner /></div>;
  if (!fullProfile) return null;

  return (
    <div className="space-y-4 mt-3">
      {SCORE_CATEGORIES.map(({ key, label }) => {
        const scores = fullProfile[key] as Record<string, number> | null | undefined;
        if (!scores || Object.keys(scores).length === 0) return null;
        return (
          <div key={key} className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {Object.entries(scores).map(([k, v]) => (
                <div key={k} className="space-y-0.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{formatKey(k)}</span>
                    <span className="font-medium">{v}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${v >= 70 ? "bg-green-500" : v >= 50 ? "bg-yellow-500" : "bg-red-400"}`}
                      style={{ width: `${v}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {Boolean(fullProfile.summary) && (
        <p className="text-xs text-muted-foreground italic">
          &ldquo;{String(fullProfile.summary ?? "")}&rdquo;
        </p>
      )}
    </div>
  );
}

// ─── Review bar ───────────────────────────────────────────────────────────────

function ReviewBar({ row }: { row: TutorEvaluationRow }) {
  const [notes, setNotes] = useState(row.ai_profile?.owner_reviewed ? "" : "");
  const reviewProfile = useReviewAiProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  if (!row.ai_profile) return null;
  if (row.ai_profile.owner_reviewed) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t mt-2">
        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
        Owner reviewed
      </div>
    );
  }

  const handle = async (recommendation: string) => {
    try {
      await reviewProfile.mutateAsync({
        profile_id: row.ai_profile!.id,
        teacher_id: row.teacher_id,
        recommendation,
        owner_notes: notes,
      });
      toast({ title: `Marked as ${recommendation}` });
      queryClient.invalidateQueries({ queryKey: ["workspace-evaluations"] });
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-2 pt-2 border-t mt-2">
      <p className="text-xs font-medium">Review this evaluation</p>
      <Textarea
        placeholder="Optional notes…"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        className="text-xs"
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => handle("approved")} disabled={reviewProfile.isPending}
          className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
        </Button>
        <Button size="sm" variant="outline" onClick={() => handle("needs_review")} disabled={reviewProfile.isPending}
          className="h-7 text-xs">
          Needs Review
        </Button>
        <Button size="sm" variant="destructive" onClick={() => handle("rejected")} disabled={reviewProfile.isPending}
          className="h-7 text-xs">
          <AlertCircle className="w-3 h-3 mr-1" /> Reject
        </Button>
      </div>
    </div>
  );
}

// ─── Tutor evaluation row ─────────────────────────────────────────────────────

function TutorEvalRow({
  row,
  onAssign,
}: {
  row: TutorEvaluationRow;
  onAssign: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasTest = !!row.latest_test;
  const hasProfile = !!row.ai_profile;
  const status = row.latest_test?.status;

  const initials = (row.profile.display_name ?? "T")[0].toUpperCase();

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="p-4 flex items-center gap-4 bg-card">
        {/* Avatar */}
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarImage src={row.profile.avatar_url ?? undefined} />
          <AvatarFallback className="text-sm font-semibold">{initials}</AvatarFallback>
        </Avatar>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{row.profile.display_name ?? "Tutor"}</p>
          <p className="text-xs text-muted-foreground truncate">{row.profile.email ?? ""}</p>
          {hasTest && row.latest_test && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {row.latest_test.subject} · {row.latest_test.grades.join(", ")}
            </p>
          )}
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {!hasTest && (
            <Badge variant="outline" className="text-xs">No Test</Badge>
          )}
          {hasTest && status && status !== "evaluated" && STATUS_CONFIG[status] && (
            <Badge variant={STATUS_CONFIG[status].variant} className="text-xs">
              {STATUS_CONFIG[status].label}
            </Badge>
          )}
          {hasProfile && row.ai_profile && (
            <>
              <Badge variant={RECOMMENDATION_CONFIG[row.ai_profile.recommendation]?.variant ?? "secondary"}
                className="text-xs">
                {RECOMMENDATION_CONFIG[row.ai_profile.recommendation]?.label}
              </Badge>
              <span className="font-bold text-sm tabular-nums">{row.ai_profile.overall_score}/100</span>
            </>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {(!hasTest || row.ai_profile?.recommendation === "rejected") && (
            <Button size="sm" variant="outline" onClick={onAssign} className="h-7 text-xs">
              <Brain className="w-3 h-3 mr-1" />
              {row.ai_profile?.recommendation === "rejected" ? "Re-evaluate" : "Assign Test"}
            </Button>
          )}
          {hasProfile && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setExpanded((e) => !e)}
              className="h-7 px-2"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          )}
        </div>
      </div>

      {/* Expanded: score breakdown + review */}
      {expanded && hasProfile && row.ai_profile && (
        <div className="border-t border-border p-4 bg-muted/10 space-y-3">
          {/* Summary row */}
          <div className="flex items-center gap-4">
            <div>
              <p className="text-2xl font-bold">{row.ai_profile.overall_score}/100</p>
              <p className="text-xs text-muted-foreground">Overall Score</p>
            </div>
            <Progress value={row.ai_profile.overall_score} className="flex-1 h-2" />
          </div>

          {/* Nature + best for */}
          {row.ai_profile.teacher_nature && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Nature:</span> {row.ai_profile.teacher_nature}
            </p>
          )}
          {row.ai_profile.best_for?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {row.ai_profile.best_for.map((b, i) => (
                <Badge key={i} variant="secondary" className="text-xs py-0">{b}</Badge>
              ))}
            </div>
          )}

          {/* Full score breakdown (lazy loaded) */}
          <ScoreBreakdown profileId={row.ai_profile.id} />

          {/* Review bar */}
          <ReviewBar row={row} />
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OwnerEvaluationsHub() {
  const { data, isLoading, refetch } = useWorkspaceEvaluations();
  const [assigningTutor, setAssigningTutor] = useState<TutorEvaluationRow | null>(null);

  const evaluations = data?.evaluations ?? [];
  const approvedCount = data?.approved_count ?? 0;

  const evaluated = evaluations.filter((e) => !!e.ai_profile).length;
  const pending = evaluations.filter((e) => e.latest_test && !e.ai_profile).length;
  const noTest = evaluations.filter((e) => !e.latest_test).length;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Tutor Evaluations</h1>
            <p className="text-muted-foreground mt-1">
              Assign AI evaluation tests to tutors and review their results.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Stats */}
        {evaluations.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total Tutors", value: evaluations.length, color: "text-foreground" },
              { label: "Evaluated", value: evaluated, color: "text-blue-600" },
              { label: "Approved", value: approvedCount, color: "text-green-600" },
              { label: "No Test Yet", value: noTest, color: "text-muted-foreground" },
            ].map(({ label, value, color }) => (
              <Card key={label}>
                <CardContent className="p-4">
                  <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Minimum warning */}
        {!isLoading && approvedCount < 2 && evaluations.length > 0 && (
          <div className={`flex items-start gap-3 p-4 rounded-xl border ${
            approvedCount === 0
              ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800"
              : "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800"
          }`}>
            <AlertCircle className={`w-5 h-5 shrink-0 mt-0.5 ${approvedCount === 0 ? "text-red-500" : "text-yellow-500"}`} />
            <div>
              <p className={`text-sm font-medium ${approvedCount === 0 ? "text-red-700 dark:text-red-400" : "text-yellow-700 dark:text-yellow-400"}`}>
                {approvedCount === 0
                  ? "No approved tutors yet"
                  : "Only 1 approved tutor"}
              </p>
              <p className={`text-xs mt-0.5 ${approvedCount === 0 ? "text-red-600 dark:text-red-500" : "text-yellow-600 dark:text-yellow-500"}`}>
                At least 2 approved evaluations are required before AI tutor matching can produce meaningful results.
              </p>
            </div>
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : evaluations.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-16 gap-4">
              <Users className="w-12 h-12 text-muted-foreground" />
              <p className="text-lg font-medium">No tutors in workspace</p>
              <p className="text-sm text-muted-foreground">
                Invite tutors first, then assign evaluation tests here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {evaluations.map((row) => (
              <TutorEvalRow
                key={row.teacher_id}
                row={row}
                onAssign={() => setAssigningTutor(row)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Assign dialog */}
      {assigningTutor && (
        <AssignDialog
          tutor={assigningTutor}
          open={!!assigningTutor}
          onClose={() => setAssigningTutor(null)}
        />
      )}
    </DashboardLayout>
  );
}
