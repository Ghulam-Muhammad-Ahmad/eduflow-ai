import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import {
  useWorkspaceLectureSessions,
  useGoogleCalendarConnection,
  useCancelLectureSession,
  useUpdateLectureSession,
  useCompleteLectureSession,
  useCreateLectureSession,
  useSaveLectureSessionNote,
  useSaveLectureSessionFinancial,
  useLectureSessionNotes,
  useLectureSessionFinancial,
  type LectureSession,
  type LectureSessionFinancialMock,
  type TutorRateType,
  type StudentChargeType,
} from "@/hooks/useLectureSessions";
import { SessionsTable } from "@/components/lectures/SessionsTable";
import { AlertTriangle, CalendarClock, Plus, Search } from "lucide-react";
import { addMinutes, format, setHours, setMinutes, startOfTomorrow } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";

type SessionFilter = "active" | "completed" | "cancelled" | "all";

type FinancialFormState = {
  tutorRateAmount: string;
  tutorRateCurrency: string;
  tutorRateType: TutorRateType;
  studentChargeAmount: string;
  studentChargeCurrency: string;
  studentChargeType: StudentChargeType;
};

const EMPTY_FINANCIAL_FORM: FinancialFormState = {
  tutorRateAmount: "0",
  tutorRateCurrency: "GBP",
  tutorRateType: "hourly",
  studentChargeAmount: "0",
  studentChargeCurrency: "GBP",
  studentChargeType: "per_session",
};

function toLocalInputValue(value: string) {
  return value.slice(0, 16);
}

export default function OwnerSessions() {
  const router = useRouter();
  const { workspaceId, classrooms, tutors, tutorsByClassroomId, isLoading: workspaceLoading } = useOwnerWorkspace();
  const { data: sessions = [], isLoading: sessionsLoading } = useWorkspaceLectureSessions(workspaceId);
  const { data: googleCalendarConnection } = useGoogleCalendarConnection();
  const cancelLecture = useCancelLectureSession();
  const updateLecture = useUpdateLectureSession();
  const completeLecture = useCompleteLectureSession();
  const saveLectureNote = useSaveLectureSessionNote();
  const saveLectureFinancial = useSaveLectureSessionFinancial();
  const { toast } = useToast();

  const classroomIdFromQuery = typeof router.query.classroomId === "string" ? router.query.classroomId : null;

  const [sessionFilter, setSessionFilter] = useState<SessionFilter>("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [classroomFilter, setClassroomFilter] = useState<string>(classroomIdFromQuery ?? "all");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<LectureSession | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", startsAt: "", endsAt: "" });
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteSession, setNoteSession] = useState<LectureSession | null>(null);
  const [noteContent, setNoteContent] = useState("");
  const [financialDialogOpen, setFinancialDialogOpen] = useState(false);
  const [financialSession, setFinancialSession] = useState<LectureSession | null>(null);
  const [financialForm, setFinancialForm] = useState<FinancialFormState>(EMPTY_FINANCIAL_FORM);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    classroomId: "",
    tutorId: "",
    title: "",
    description: "",
    notes: "",
    startsAt: "",
    endsAt: "",
    instantSession: false,
    durationMinutes: 30,
    recurrenceFrequency: "none" as "none" | "daily" | "weekly",
    recurrenceInterval: "1",
    occurrencesCount: "4",
  });

  const createLecture = useCreateLectureSession();

  const tutorMap = useMemo(
    () => new Map(tutors.map((t) => [t.user_id, t.profile?.display_name ?? t.profile?.email ?? "Tutor"])),
    [tutors]
  );
  const classroomMap = useMemo(() => new Map(classrooms.map((c) => [c.id, c.name])), [classrooms]);

  const noteSessionIds = useMemo(
    () => sessions.filter((s) => s.status === "completed").map((s) => s.id),
    [sessions]
  );
  const { data: notesBySession = {} } = useLectureSessionNotes(noteSessionIds, true);
  const { data: activeFinancial } = useLectureSessionFinancial(
    financialSession?.id ?? null,
    financialDialogOpen
  );

  useEffect(() => {
    if (financialDialogOpen && financialSession && activeFinancial) {
      const financial = activeFinancial as LectureSessionFinancialMock | null | undefined;
      setFinancialForm({
        tutorRateAmount: financial?.tutor_rate_amount != null ? String(financial.tutor_rate_amount) : "0",
        tutorRateCurrency: financial?.tutor_rate_currency ?? "GBP",
        tutorRateType: (financial?.tutor_rate_type as TutorRateType | undefined) ?? "hourly",
        studentChargeAmount:
          financial?.student_charge_amount != null ? String(financial.student_charge_amount) : "0",
        studentChargeCurrency: financial?.student_charge_currency ?? "GBP",
        studentChargeType:
          (financial?.student_charge_type as StudentChargeType | undefined) ?? "per_session",
      });
    }
  }, [activeFinancial, financialDialogOpen, financialSession]);

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

  const disableSchedulingReason = !googleCalendarConnection?.configured
    ? "Google Meet scheduling is unavailable until Google OAuth is configured on the server."
    : !googleCalendarConnection.connected
      ? "Connect Google Calendar in Settings before creating lectures."
      : null;

  const tutorsForSelectedClassroom = useMemo(() => {
    if (!createForm.classroomId) return [];
    return tutorsByClassroomId.get(createForm.classroomId) ?? [];
  }, [createForm.classroomId, tutorsByClassroomId]);

  const resetCreateForm = () => {
    const tomorrow = startOfTomorrow();
    const defaultStart = setMinutes(setHours(tomorrow, 10), 0);
    const defaultEnd = addMinutes(defaultStart, 30);
    setCreateForm({
      classroomId: classroomIdFromQuery ?? "",
      tutorId: "",
      title: "",
      description: "",
      notes: "",
      startsAt: format(defaultStart, "yyyy-MM-dd'T'HH:mm"),
      endsAt: format(defaultEnd, "yyyy-MM-dd'T'HH:mm"),
      instantSession: false,
      durationMinutes: 30,
      recurrenceFrequency: "none",
      recurrenceInterval: "1",
      occurrencesCount: "4",
    });
  };

  const handleCreateSchedule = async () => {
    if (!createForm.title.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    if (!createForm.classroomId) {
      toast({ title: "Select a classroom", variant: "destructive" });
      return;
    }
    let startsAt: string;
    let endsAt: string;
    if (createForm.instantSession) {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes());
      const end = addMinutes(start, createForm.durationMinutes);
      startsAt = start.toISOString();
      endsAt = end.toISOString();
    } else {
      if (!createForm.startsAt || !createForm.endsAt) {
        toast({ title: "Start and end time required", variant: "destructive" });
        return;
      }
      startsAt = new Date(createForm.startsAt).toISOString();
      endsAt = new Date(createForm.endsAt).toISOString();
      if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
        toast({ title: "End must be after start", variant: "destructive" });
        return;
      }
    }
    const description = [createForm.description, createForm.notes].filter(Boolean).join("\n\n") || null;
    const recurrenceActive =
      createForm.recurrenceFrequency !== "none" && Number(createForm.occurrencesCount) > 1;
    const recurrenceFreq: "daily" | "weekly" | null =
      recurrenceActive && createForm.recurrenceFrequency !== "none"
        ? createForm.recurrenceFrequency
        : null;
    await createLecture.mutateAsync({
      scopeType: "classroom",
      classroomId: createForm.classroomId,
      tutorId: createForm.tutorId || undefined,
      title: createForm.title.trim(),
      description,
      startsAt,
      endsAt,
      recurrenceFrequency: recurrenceFreq,
      recurrenceInterval: recurrenceActive ? Number(createForm.recurrenceInterval) || 1 : 1,
      occurrencesCount: recurrenceActive ? Math.max(2, Number(createForm.occurrencesCount) || 2) : 1,
    });
    setCreateDialogOpen(false);
    resetCreateForm();
  };

  const handleCancel = async (session: LectureSession, mode: "single" | "series") => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        mode === "series"
          ? `Cancel the entire recurring series for "${session.title}"?`
          : `Cancel "${session.title}"?`
      );
      if (!confirmed) return;
    }
    await cancelLecture.mutateAsync({
      id: session.id,
      classroom_id: session.classroom_id,
      student_id: session.student_id,
      series_id: session.series_id,
      mode,
    });
  };

  const handleComplete = async (session: LectureSession) => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(`Mark "${session.title}" as completed?`);
      if (!confirmed) return;
    }
    await completeLecture.mutateAsync(session.id);
  };

  const openEditDialog = (session: LectureSession) => {
    setEditingSession(session);
    setEditForm({
      title: session.title,
      description: session.description ?? "",
      startsAt: toLocalInputValue(session.starts_at),
      endsAt: toLocalInputValue(session.ends_at),
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingSession) return;
    if (!editForm.title.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    if (!editForm.startsAt || !editForm.endsAt) {
      toast({ title: "Start and end time required", variant: "destructive" });
      return;
    }
    const startsAt = new Date(editForm.startsAt).toISOString();
    const endsAt = new Date(editForm.endsAt).toISOString();
    if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      toast({ title: "End must be after start", variant: "destructive" });
      return;
    }
    await updateLecture.mutateAsync({
      id: editingSession.id,
      title: editForm.title.trim(),
      description: editForm.description.trim() || null,
      startsAt,
      endsAt,
    });
    setEditDialogOpen(false);
    setEditingSession(null);
  };

  const openNotesDialog = (session: LectureSession) => {
    setNoteSession(session);
    setNoteContent(notesBySession[session.id]?.content ?? "");
    setNoteDialogOpen(true);
  };

  const handleSaveNotes = async () => {
    if (!noteSession) return;
    await saveLectureNote.mutateAsync({ sessionId: noteSession.id, content: noteContent });
    setNoteDialogOpen(false);
    setNoteSession(null);
    setNoteContent("");
  };

  const openFinancialDialog = (session: LectureSession) => {
    setFinancialSession(session);
    setFinancialDialogOpen(true);
  };

  const handleSaveFinancial = async () => {
    if (!financialSession) return;
    await saveLectureFinancial.mutateAsync({
      sessionId: financialSession.id,
      tutorRateAmount: Number(financialForm.tutorRateAmount) || 0,
      tutorRateCurrency: financialForm.tutorRateCurrency.trim().toUpperCase() || "GBP",
      tutorRateType: financialForm.tutorRateType,
      studentChargeAmount: Number(financialForm.studentChargeAmount) || 0,
      studentChargeCurrency:
        financialForm.studentChargeCurrency.trim().toUpperCase() || "GBP",
      studentChargeType: financialForm.studentChargeType,
    });
    setFinancialDialogOpen(false);
    setFinancialSession(null);
    setFinancialForm(EMPTY_FINANCIAL_FORM);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Lecture sessions</h1>
            <p className="text-muted-foreground mt-1">
              Schedule and manage Google Meet lectures for your classrooms.
            </p>
          </div>
          <Button
            className="gap-2"
            onClick={() => setCreateDialogOpen(true)}
            disabled={Boolean(disableSchedulingReason)}
            title={disableSchedulingReason ?? undefined}
          >
            <Plus className="h-4 w-4" />
            Schedule lecture
          </Button>
        </div>

        {disableSchedulingReason && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>{disableSchedulingReason}</p>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/settings">Go to Settings</Link>
            </Button>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" />
              Sessions
            </CardTitle>
            <CardDescription>
              Filter by status, classroom, or search. Connect Google Calendar in Settings to schedule.
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
                    <SelectValue placeholder="Classroom" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All classrooms</SelectItem>
                    {classrooms.map((c) => (
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

            {workspaceLoading || sessionsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 rounded-lg border bg-secondary/30 animate-pulse" />
                ))}
              </div>
            ) : visibleSessions.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                {searchQuery.trim() || classroomFilter !== "all"
                  ? "No sessions match the current filters."
                  : "No lecture sessions yet. Connect Google Calendar in Settings, then schedule a lecture."}
              </div>
            ) : (
              <SessionsTable
                sessions={visibleSessions}
                role="owner"
                tutorMap={tutorMap}
                classroomMap={classroomMap}
                notesBySession={notesBySession}
                onEdit={openEditDialog}
                onCancelSingle={(s) => handleCancel(s, "single")}
                onCancelSeries={(s) => handleCancel(s, "series")}
                onComplete={handleComplete}
                onEditNotes={openNotesDialog}
                onEditFinancials={openFinancialDialog}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit lecture</DialogTitle>
            <DialogDescription>Update the session title and time.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start</Label>
                <Input
                  type="datetime-local"
                  value={editForm.startsAt}
                  onChange={(e) => setEditForm((f) => ({ ...f, startsAt: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>End</Label>
                <Input
                  type="datetime-local"
                  value={editForm.endsAt}
                  onChange={(e) => setEditForm((f) => ({ ...f, endsAt: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateLecture.isPending}>
              {updateLecture.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Note dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Private tutor notes</DialogTitle>
            <DialogDescription>
              Visible to the assigned tutor and workspace owners only.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label>Notes</Label>
            <Textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              rows={8}
              placeholder="Summarize what was covered, progress, next steps."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveNotes} disabled={saveLectureNote.isPending}>
              {saveLectureNote.isPending ? "Saving..." : "Save notes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Financial dialog - simplified, same structure as ClassroomLectureSection */}
      <Dialog
        open={financialDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setFinancialSession(null);
            setFinancialForm(EMPTY_FINANCIAL_FORM);
          }
          setFinancialDialogOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mock pricing inputs</DialogTitle>
            <DialogDescription>
              For preview payroll and billing summaries only.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
              <p className="text-sm font-medium">Tutor payroll</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Rate type</Label>
                  <Select
                    value={financialForm.tutorRateType}
                    onValueChange={(v: TutorRateType) =>
                      setFinancialForm((f) => ({ ...f, tutorRateType: v }))
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="per_session">Per session</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={financialForm.tutorRateAmount}
                    onChange={(e) =>
                      setFinancialForm((f) => ({ ...f, tutorRateAmount: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Input
                    value={financialForm.tutorRateCurrency}
                    onChange={(e) =>
                      setFinancialForm((f) => ({ ...f, tutorRateCurrency: e.target.value.toUpperCase() }))
                    }
                    maxLength={8}
                  />
                </div>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
              <p className="text-sm font-medium">Student billing</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Charge type</Label>
                  <Select
                    value={financialForm.studentChargeType}
                    onValueChange={(v: StudentChargeType) =>
                      setFinancialForm((f) => ({ ...f, studentChargeType: v }))
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="per_session">Per session</SelectItem>
                      <SelectItem value="per_student">Per student</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={financialForm.studentChargeAmount}
                    onChange={(e) =>
                      setFinancialForm((f) => ({ ...f, studentChargeAmount: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Input
                    value={financialForm.studentChargeCurrency}
                    onChange={(e) =>
                      setFinancialForm((f) => ({ ...f, studentChargeCurrency: e.target.value.toUpperCase() }))
                    }
                    maxLength={8}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFinancialDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveFinancial} disabled={saveLectureFinancial.isPending}>
              {saveLectureFinancial.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create dialog */}
      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (open) resetCreateForm();
          if (!open) resetCreateForm();
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
            <DialogTitle>Schedule lecture</DialogTitle>
            <DialogDescription>
              Choose classroom, date and time. Add optional notes for the session.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 py-4 overflow-y-auto flex-1 min-h-0">
            <div className="space-y-2">
              <Label>Classroom</Label>
              <Select
                value={createForm.classroomId}
                onValueChange={(v) =>
                  setCreateForm((f) => ({
                    ...f,
                    classroomId: v,
                    tutorId: "",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select classroom" />
                </SelectTrigger>
                <SelectContent>
                  {classrooms.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {tutorsForSelectedClassroom.length > 1 && (
              <div className="space-y-2">
                <Label>Tutor</Label>
                <Select
                  value={createForm.tutorId}
                  onValueChange={(v) => setCreateForm((f) => ({ ...f, tutorId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select tutor" />
                  </SelectTrigger>
                  <SelectContent>
                    {tutorsForSelectedClassroom.map((uid) => (
                      <SelectItem key={uid} value={uid}>
                        {tutorMap.get(uid) ?? "Tutor"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={createForm.title}
                onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Weekly live lecture"
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                value={createForm.description}
                onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                rows={1}
                placeholder="Agenda or materials"
                className="resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={createForm.notes}
                onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
                rows={1}
                placeholder="Private notes for this schedule"
                className="resize-none"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="instant"
                checked={createForm.instantSession}
                onCheckedChange={(checked) =>
                  setCreateForm((f) => ({ ...f, instantSession: checked === true }))
                }
              />
              <Label htmlFor="instant" className="font-normal cursor-pointer">
                Start immediately (instant session)
              </Label>
            </div>
            {createForm.instantSession ? (
              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Select
                  value={String(createForm.durationMinutes)}
                  onValueChange={(v) =>
                    setCreateForm((f) => ({ ...f, durationMinutes: Number(v) }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 min</SelectItem>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="45">45 min</SelectItem>
                    <SelectItem value="60">60 min</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start</Label>
                    <Input
                      type="datetime-local"
                      value={createForm.startsAt}
                      onChange={(e) => setCreateForm((f) => ({ ...f, startsAt: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End</Label>
                    <Input
                      type="datetime-local"
                      value={createForm.endsAt}
                      onChange={(e) => setCreateForm((f) => ({ ...f, endsAt: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
                  <Label>Recurrence</Label>
                  <Select
                    value={createForm.recurrenceFrequency}
                    onValueChange={(v: "none" | "daily" | "weekly") =>
                      setCreateForm((f) => ({ ...f, recurrenceFrequency: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Does not repeat</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                  {createForm.recurrenceFrequency !== "none" && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Every (interval)</Label>
                        <Input
                          type="number"
                          min={1}
                          value={createForm.recurrenceInterval}
                          onChange={(e) =>
                            setCreateForm((f) => ({ ...f, recurrenceInterval: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Occurrences</Label>
                        <Input
                          type="number"
                          min={2}
                          max={24}
                          value={createForm.occurrencesCount}
                          onChange={(e) =>
                            setCreateForm((f) => ({ ...f, occurrencesCount: e.target.value }))
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          <DialogFooter className="shrink-0 px-6 py-4 border-t bg-muted/30">
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSchedule} disabled={createLecture.isPending}>
              {createLecture.isPending ? "Scheduling..." : "Schedule lecture"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
