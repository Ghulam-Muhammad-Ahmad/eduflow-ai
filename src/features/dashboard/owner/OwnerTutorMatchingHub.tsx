import { useState } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  useStudentRequirements,
  useWorkspaceEvaluations,
  useCreateRequirement,
  useUpdateRequirement,
  useDeleteRequirement,
  useRunMatching,
  useTeacherAiProfile,
  type StudentRequirement,
  type MatchResult,
} from "@/hooks/useTutorMatching";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import {
  Plus,
  Trash2,
  AlertTriangle as WarningIcon,
  Users,
  School,
  Sparkles,
  Pencil,
  Trophy,
  AlertTriangle,
  CheckCircle2,
  Info,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const STUDENT_LEVELS = ["beginner", "weak", "average", "advanced"];
const STUDENT_NATURES = ["shy", "hyperactive", "exam_pressure", "slow_learner", "motivated"];

const STATUS_CONFIG = {
  open: { label: "Open", variant: "secondary" as const },
  matched: { label: "Matched", variant: "default" as const },
  closed: { label: "Closed", variant: "outline" as const },
};

const DEFAULT_FORM = {
  requirement_type: "student" as "student" | "class",
  student_name: "",
  classroom_id: "",
  subject: "",
  grade: "",
  curriculum: "",
  student_level: "" as StudentRequirement["student_level"] | "",
  student_nature: [] as string[],
  goal: "",
  preferred_teaching_style: "",
  language: "English",
  budget_hourly: "" as string,
  availability: "",
};

// ─── Match result panel ───────────────────────────────────────────────────────

type EmptyResult = { matches: []; reason: string; message: string };
type AnyMatch = MatchResult | EmptyResult;

function isEmptyResult(r: AnyMatch): r is EmptyResult {
  return "reason" in r && Array.isArray((r as EmptyResult).matches) && (r as EmptyResult).matches.length === 0;
}

function MatchPanel({
  result,
  tutorMap,
  onClose,
}: {
  result: AnyMatch;
  tutorMap: Map<string, { display_name?: string; email?: string }>;
  onClose: () => void;
}) {
  if (isEmptyResult(result)) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center py-10 gap-3">
          <Users className="w-10 h-10 text-muted-foreground" />
          <p className="font-medium">No approved tutors available</p>
          <p className="text-sm text-muted-foreground text-center max-w-xs">{result.message}</p>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4 mr-1" /> Close
          </Button>
        </CardContent>
      </Card>
    );
  }

  const ranked = result.ranked_matches ?? [];
  const best = result.best_match;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-sm">{ranked.length} tutor{ranked.length !== 1 ? "s" : ""} ranked</p>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4 mr-1" /> Close
        </Button>
      </div>
      {ranked.map((match, i) => {
        const isBest = best?.teacher_id === match.teacher_id;
        const tutor = tutorMap.get(match.teacher_id);
        const reasons = isBest ? (best?.reason ?? match.reason) : match.reason;
        const risks = isBest ? (best?.possible_risks ?? []) : [];
        const ownerNote = isBest ? (best?.owner_note ?? "") : "";
        const score = isBest ? (best?.match_score ?? match.match_score) : match.match_score;

        return (
          <Card key={match.teacher_id} className={isBest ? "border-primary shadow-sm" : ""}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {isBest && <Trophy className="w-4 h-4 text-yellow-500 shrink-0" />}
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">
                      {tutor?.display_name ?? `Tutor ${i + 1}`}
                    </p>
                    {tutor?.email && (
                      <p className="text-xs text-muted-foreground truncate">{tutor.email}</p>
                    )}
                  </div>
                </div>
                <Badge variant={isBest ? "default" : "secondary"} className="shrink-0">
                  {Math.round(score)}% match
                </Badge>
              </div>
              <Progress value={score} className="h-1.5" />
              {reasons?.length > 0 && (
                <ul className="space-y-0.5">
                  {reasons.map((r, ri) => (
                    <li key={ri} className="text-xs flex gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0 mt-0.5" />
                      {r}
                    </li>
                  ))}
                </ul>
              )}
              {risks.length > 0 && (
                <ul className="space-y-0.5">
                  {risks.map((r, ri) => (
                    <li key={ri} className="text-xs flex gap-1.5">
                      <AlertTriangle className="w-3 h-3 text-yellow-500 shrink-0 mt-0.5" />
                      {r}
                    </li>
                  ))}
                </ul>
              )}
              {ownerNote && (
                <div className="flex gap-1.5 p-2 bg-muted rounded text-xs">
                  <Info className="w-3 h-3 shrink-0 mt-0.5 text-muted-foreground" />
                  {ownerNote}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Requirement row ──────────────────────────────────────────────────────────

function RequirementRow({
  req,
  classroomName,
  onEdit,
  onDelete,
  onFindTutor,
  isDeleting,
  isMatching,
  isExpanded,
  matchResult,
  tutorMap,
  onCloseMatch,
}: {
  req: StudentRequirement;
  classroomName?: string;
  onEdit: () => void;
  onDelete: () => void;
  onFindTutor: () => void;
  isDeleting: boolean;
  isMatching: boolean;
  isExpanded: boolean;
  matchResult: AnyMatch | null;
  tutorMap: Map<string, { display_name?: string; email?: string }>;
  onCloseMatch: () => void;
}) {
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="p-4 flex items-center gap-4 bg-card hover:bg-muted/20 transition-colors">
        {/* Type icon */}
        <div className="shrink-0">
          {req.requirement_type === "class" ? (
            <School className="w-5 h-5 text-muted-foreground" />
          ) : (
            <Users className="w-5 h-5 text-muted-foreground" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">
              {req.requirement_type === "class" && classroomName
                ? classroomName
                : req.student_name}
            </span>
            <Badge variant="outline" className="text-xs py-0">
              {req.requirement_type === "class" ? "Class" : "Student"}
            </Badge>
            <Badge variant={STATUS_CONFIG[req.status]?.variant ?? "secondary"} className="text-xs py-0">
              {STATUS_CONFIG[req.status]?.label ?? req.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {req.subject} · Grade {req.grade} · {req.curriculum}
            {req.student_level && ` · ${req.student_level}`}
          </p>
          {req.goal && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{req.goal}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button variant="outline" size="sm" onClick={onEdit} className="h-7 px-2">
            <Pencil className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            onClick={onFindTutor}
            disabled={isMatching}
            className="h-7 px-3 gap-1"
          >
            {isMatching ? (
              <Spinner className="h-3 w-3" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            Find Tutor
            {isExpanded ? (
              <ChevronUp className="w-3 h-3 ml-0.5" />
            ) : (
              <ChevronDown className="w-3 h-3 ml-0.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            disabled={isDeleting}
            className="h-7 px-2"
          >
            <Trash2 className="w-3 h-3 text-destructive" />
          </Button>
        </div>
      </div>

      {/* Inline match results */}
      {isExpanded && matchResult && (
        <div className="border-t border-border p-4 bg-muted/10">
          <MatchPanel result={matchResult} tutorMap={tutorMap} onClose={onCloseMatch} />
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OwnerTutorMatchingHub() {
  const router = useRouter();
  const { data: requirements = [], isLoading } = useStudentRequirements();
  const { data: evalData } = useWorkspaceEvaluations();
  const approvedCount = evalData?.approved_count ?? 0;
  const createReq = useCreateRequirement();
  const updateReq = useUpdateRequirement();
  const deleteReq = useDeleteRequirement();
  const runMatching = useRunMatching();
  const { tutors, classrooms } = useOwnerWorkspace();
  const { toast } = useToast();

  const [tab, setTab] = useState<"all" | "student" | "class">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);

  // Per-requirement match state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [matchResults, setMatchResults] = useState<Record<string, AnyMatch>>({});
  const [matchingId, setMatchingId] = useState<string | null>(null);

  const tutorMap = new Map(
    tutors.map((t) => [
      t.user_id,
      {
        display_name: (t as unknown as { display_name?: string }).display_name ?? (t.profile as { display_name?: string } | undefined)?.display_name,
        email: (t as unknown as { email?: string }).email ?? (t.profile as { email?: string } | undefined)?.email,
      },
    ])
  );

  const classroomMap = new Map(classrooms.map((c) => [c.id, c.name]));

  const filtered = requirements.filter((r) => {
    if (tab === "student") return r.requirement_type !== "class";
    if (tab === "class") return r.requirement_type === "class";
    return true;
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  };

  const openEdit = (req: StudentRequirement) => {
    setEditingId(req.id);
    setForm({
      requirement_type: req.requirement_type,
      student_name: req.student_name,
      classroom_id: req.classroom_id ?? "",
      subject: req.subject,
      grade: req.grade,
      curriculum: req.curriculum,
      student_level: req.student_level ?? "",
      student_nature: req.student_nature ?? [],
      goal: req.goal ?? "",
      preferred_teaching_style: req.preferred_teaching_style ?? "",
      language: req.language,
      budget_hourly: req.budget_hourly != null ? String(req.budget_hourly) : "",
      availability: (req.availability ?? []).join(", "),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.subject || !form.grade || !form.curriculum) {
      toast({ title: "Fill subject, grade, and curriculum", variant: "destructive" });
      return;
    }
    if (form.requirement_type === "student" && !form.student_name) {
      toast({ title: "Student name required", variant: "destructive" });
      return;
    }
    if (form.requirement_type === "class" && !form.classroom_id) {
      toast({ title: "Select a classroom", variant: "destructive" });
      return;
    }

    const classroomLabel =
      form.requirement_type === "class" && form.classroom_id
        ? (classroomMap.get(form.classroom_id) ?? "Class")
        : form.student_name;

    const payload = {
      requirement_type: form.requirement_type,
      student_name: classroomLabel,
      student_id: null,
      classroom_id: form.requirement_type === "class" ? form.classroom_id || null : null,
      subject: form.subject,
      grade: form.grade,
      curriculum: form.curriculum,
      student_level: (form.student_level || null) as StudentRequirement["student_level"],
      student_nature: form.student_nature,
      goal: form.goal || null,
      preferred_teaching_style: form.preferred_teaching_style || null,
      language: form.language || "English",
      budget_hourly: form.budget_hourly ? Number(form.budget_hourly) : null,
      availability: form.availability
        ? form.availability.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
    };

    try {
      if (editingId) {
        await updateReq.mutateAsync({ id: editingId, ...payload });
        toast({ title: "Requirement updated" });
      } else {
        await createReq.mutateAsync(payload);
        toast({ title: "Requirement created" });
      }
      setDialogOpen(false);
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteReq.mutateAsync(id);
      if (expandedId === id) setExpandedId(null);
      toast({ title: "Requirement deleted" });
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handleFindTutor = async (id: string) => {
    if (expandedId === id && matchResults[id]) {
      setExpandedId(null);
      return;
    }
    setMatchingId(id);
    try {
      const result = await runMatching.mutateAsync(id);
      setMatchResults((prev) => ({ ...prev, [id]: result as AnyMatch }));
      setExpandedId(id);
    } catch (err) {
      toast({ title: "Matching failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setMatchingId(null);
    }
  };

  const toggleNature = (n: string) => {
    setForm((f) => ({
      ...f,
      student_nature: f.student_nature.includes(n)
        ? f.student_nature.filter((x) => x !== n)
        : [...f.student_nature, n],
    }));
  };

  // Auto-fill subject/grade/curriculum when classroom selected
  const handleClassroomSelect = (cid: string) => {
    const cls = classrooms.find((c) => c.id === cid);
    setForm((f) => ({
      ...f,
      classroom_id: cid,
      subject: cls?.subject ?? f.subject,
    }));
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Tutor Matching</h1>
            <p className="text-muted-foreground mt-1">
              Define requirements for students or classes, then find the best-fit tutor.
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" /> New Requirement
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="all">All ({requirements.length})</TabsTrigger>
            <TabsTrigger value="student">
              <Users className="w-3.5 h-3.5 mr-1.5" />
              Students ({requirements.filter((r) => r.requirement_type !== "class").length})
            </TabsTrigger>
            <TabsTrigger value="class">
              <School className="w-3.5 h-3.5 mr-1.5" />
              Classes ({requirements.filter((r) => r.requirement_type === "class").length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Evaluation warning */}
        {approvedCount < 2 && (
          <div className={`flex items-start gap-3 p-4 rounded-xl border ${
            approvedCount === 0
              ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800"
              : "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800"
          }`}>
            <WarningIcon className={`w-5 h-5 shrink-0 mt-0.5 ${approvedCount === 0 ? "text-red-500" : "text-yellow-500"}`} />
            <div className="flex-1">
              <p className={`text-sm font-medium ${approvedCount === 0 ? "text-red-700 dark:text-red-400" : "text-yellow-700 dark:text-yellow-400"}`}>
                {approvedCount === 0
                  ? "No evaluations done — matching unavailable"
                  : `Only ${approvedCount} approved tutor — need at least 2`}
              </p>
              <p className={`text-xs mt-0.5 ${approvedCount === 0 ? "text-red-600 dark:text-red-500" : "text-yellow-600 dark:text-yellow-500"}`}>
                {approvedCount === 0
                  ? "No tutors have been evaluated yet. Complete at least 2 tutor evaluations and approve them before running AI matching."
                  : "AI matching needs at least 2 approved tutors to rank meaningfully. Evaluate and approve one more tutor."}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 text-xs h-7"
              onClick={() => router.push("/dashboard/owner/evaluations")}
            >
              Go to Evaluations
            </Button>
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-16 gap-4">
              {tab === "class" ? (
                <School className="w-12 h-12 text-muted-foreground" />
              ) : (
                <Users className="w-12 h-12 text-muted-foreground" />
              )}
              <p className="text-lg font-medium">No requirements yet</p>
              <p className="text-muted-foreground text-sm">
                Create a requirement to start AI tutor matching.
              </p>
              <Button onClick={openCreate}>
                <Plus className="w-4 h-4 mr-2" /> New Requirement
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((req) => (
              <RequirementRow
                key={req.id}
                req={req}
                classroomName={req.classroom_id ? classroomMap.get(req.classroom_id) : undefined}
                onEdit={() => openEdit(req)}
                onDelete={() => handleDelete(req.id)}
                onFindTutor={() => handleFindTutor(req.id)}
                isDeleting={deleteReq.isPending}
                isMatching={matchingId === req.id}
                isExpanded={expandedId === req.id}
                matchResult={matchResults[req.id] ?? null}
                tutorMap={tutorMap}
                onCloseMatch={() => setExpandedId(null)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Requirement" : "New Requirement"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Requirement type toggle */}
            <div className="space-y-1">
              <Label>Requirement For *</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, requirement_type: "student", classroom_id: "" }))}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    form.requirement_type === "student"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary"
                  }`}
                >
                  <Users className="w-4 h-4" /> Student
                </button>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, requirement_type: "class", student_name: "" }))}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    form.requirement_type === "class"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary"
                  }`}
                >
                  <School className="w-4 h-4" /> Class
                </button>
              </div>
            </div>

            {/* Student name OR classroom picker */}
            {form.requirement_type === "student" ? (
              <div className="space-y-1">
                <Label>Student Name *</Label>
                <Input
                  value={form.student_name}
                  onChange={(e) => setForm((f) => ({ ...f, student_name: e.target.value }))}
                  placeholder="e.g. Ali"
                />
              </div>
            ) : (
              <div className="space-y-1">
                <Label>Classroom *</Label>
                {classrooms.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No classrooms found in workspace.</p>
                ) : (
                  <Select value={form.classroom_id} onValueChange={handleClassroomSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a classroom…" />
                    </SelectTrigger>
                    <SelectContent>
                      {classrooms.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}{c.subject ? ` — ${c.subject}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Subject *</Label>
                <Input
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  placeholder="e.g. Math"
                />
              </div>
              <div className="space-y-1">
                <Label>Grade *</Label>
                <Input
                  value={form.grade}
                  onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))}
                  placeholder="e.g. Grade 7"
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
                <Label>Student Level</Label>
                <Select
                  value={form.student_level || ""}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, student_level: v as StudentRequirement["student_level"] }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    {STUDENT_LEVELS.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l.charAt(0).toUpperCase() + l.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Nature / Traits</Label>
              <div className="flex flex-wrap gap-2">
                {STUDENT_NATURES.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => toggleNature(n)}
                    className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                      form.student_nature.includes(n)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label>Goal</Label>
              <Textarea
                value={form.goal}
                onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))}
                placeholder="e.g. Improve basics and prepare for exams"
                rows={2}
              />
            </div>

            <div className="space-y-1">
              <Label>Preferred Teaching Style</Label>
              <Input
                value={form.preferred_teaching_style}
                onChange={(e) => setForm((f) => ({ ...f, preferred_teaching_style: e.target.value }))}
                placeholder="e.g. Conceptual and slow-paced"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Language</Label>
                <Input
                  value={form.language}
                  onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
                  placeholder="English"
                />
              </div>
              <div className="space-y-1">
                <Label>Budget (hourly)</Label>
                <Input
                  type="number"
                  value={form.budget_hourly}
                  onChange={(e) => setForm((f) => ({ ...f, budget_hourly: e.target.value }))}
                  placeholder="e.g. 30"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Availability (comma-separated)</Label>
              <Input
                value={form.availability}
                onChange={(e) => setForm((f) => ({ ...f, availability: e.target.value }))}
                placeholder="e.g. Monday 6PM, Wednesday 5PM"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={createReq.isPending || updateReq.isPending}>
              {(createReq.isPending || updateReq.isPending) && (
                <Spinner className="mr-2 h-4 w-4" />
              )}
              {editingId ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
