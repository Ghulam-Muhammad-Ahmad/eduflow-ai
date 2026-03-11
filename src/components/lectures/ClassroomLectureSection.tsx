import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ExternalLink,
  NotebookPen,
  Pencil,
  Plus,
  RefreshCcw,
  Repeat,
  Search,
  Trash2,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useCancelLectureSession,
  useClassroomLectureSessions,
  useCompleteLectureSession,
  useCreateLectureSession,
  useLectureSessionFinancial,
  useLectureSessionNotes,
  useSaveLectureSessionNote,
  useSaveLectureSessionFinancial,
  useStudentLectureSessions,
  useUpdateLectureSession,
  type LectureSessionFinancialMock,
  type LectureSessionNote,
  type LectureSession,
  type StudentChargeType,
  type SessionScopeType,
  type TutorRateType,
} from "@/hooks/useLectureSessions";
import { useToast } from "@/hooks/use-toast";
import { SessionCard } from "@/components/lectures/SessionCard";

type TutorOption = {
  id: string;
  name: string;
};

type ClassroomLectureSectionProps = {
  scopeType: SessionScopeType;
  classroomId?: string | null;
  studentId?: string | null;
  targetName: string;
  canManage: boolean;
  canCompleteOutcomes?: boolean;
  canEditPrivateNotes?: boolean;
  showPrivateNotes?: boolean;
  canEditMockFinancials?: boolean;
  disableSchedulingReason?: string | null;
  tutorOptions: TutorOption[];
  defaultTutorId?: string | null;
  emptyMessage?: string;
  description?: string;
};

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

type FormState = {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  tutorId: string;
  recurrenceFrequency: "none" | "daily" | "weekly";
  recurrenceInterval: string;
  occurrencesCount: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  startsAt: "",
  endsAt: "",
  tutorId: "",
  recurrenceFrequency: "none",
  recurrenceInterval: "1",
  occurrencesCount: "4",
};

type SessionFilter = "active" | "completed" | "cancelled" | "all";

function toLocalInputValue(value: string) {
  return value.slice(0, 16);
}

export function ClassroomLectureSection({
  scopeType,
  classroomId = null,
  studentId = null,
  targetName,
  canManage,
  canCompleteOutcomes = false,
  canEditPrivateNotes = false,
  showPrivateNotes = false,
  canEditMockFinancials = false,
  disableSchedulingReason = null,
  tutorOptions,
  defaultTutorId = null,
  emptyMessage = "No lectures scheduled yet.",
  description = "Schedule and manage live lecture sessions.",
}: ClassroomLectureSectionProps) {
  const { toast } = useToast();
  const classroomSessionsQuery = useClassroomLectureSessions(scopeType === "classroom" ? classroomId : null);
  const studentSessionsQuery = useStudentLectureSessions(scopeType === "one_to_one" ? studentId : null);
  const sessionsQuery = scopeType === "classroom" ? classroomSessionsQuery : studentSessionsQuery;
  const { data: sessions = [], isLoading } = sessionsQuery;
  const createLecture = useCreateLectureSession();
  const updateLecture = useUpdateLectureSession();
  const cancelLecture = useCancelLectureSession();
  const completeLecture = useCompleteLectureSession();
  const saveLectureNote = useSaveLectureSessionNote();
  const saveLectureFinancial = useSaveLectureSessionFinancial();

  const tutorMap = useMemo(
    () => new Map(tutorOptions.map((tutor) => [tutor.id, tutor.name])),
    [tutorOptions]
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<LectureSession | null>(null);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteSession, setNoteSession] = useState<LectureSession | null>(null);
  const [noteContent, setNoteContent] = useState("");
  const [financialDialogOpen, setFinancialDialogOpen] = useState(false);
  const [financialSession, setFinancialSession] = useState<LectureSession | null>(null);
  const [financialForm, setFinancialForm] = useState<FinancialFormState>(EMPTY_FINANCIAL_FORM);
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [form, setForm] = useState<FormState>({
    ...EMPTY_FORM,
    tutorId: defaultTutorId ?? tutorOptions[0]?.id ?? "",
  });

  const orderedSessions = useMemo(() => {
    const ordered = [...sessions].sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
    );

    return ordered;
  }, [sessions]);

  const visibleSessions = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return orderedSessions.filter((session) => {
      const matchesFilter =
        sessionFilter === "all"
          ? true
          : sessionFilter === "active"
            ? session.status === "scheduled"
            : session.status === sessionFilter;
      const matchesText =
        normalizedQuery.length === 0
          ? true
          : `${session.title} ${session.description ?? ""}`.toLowerCase().includes(normalizedQuery);

      return matchesFilter && matchesText;
    });
  }, [orderedSessions, searchQuery, sessionFilter]);

  const noteSessionIds = useMemo(
    () =>
      sessions
        .filter((session) => session.status === "completed")
        .map((session) => session.id),
    [sessions]
  );

  const { data: notesBySession = {} } = useLectureSessionNotes(
    noteSessionIds,
    showPrivateNotes
  );
  const { data: activeFinancial } = useLectureSessionFinancial(
    financialSession?.id ?? null,
    financialDialogOpen
  );

  useEffect(() => {
    if (!financialDialogOpen) return;

    const financial = activeFinancial as LectureSessionFinancialMock | null | undefined;
    setFinancialForm({
      tutorRateAmount:
        financial?.tutor_rate_amount != null ? String(financial.tutor_rate_amount) : "0",
      tutorRateCurrency: financial?.tutor_rate_currency ?? "GBP",
      tutorRateType: (financial?.tutor_rate_type as TutorRateType | undefined) ?? "hourly",
      studentChargeAmount:
        financial?.student_charge_amount != null
          ? String(financial.student_charge_amount)
          : "0",
      studentChargeCurrency: financial?.student_charge_currency ?? "GBP",
      studentChargeType:
        (financial?.student_charge_type as StudentChargeType | undefined) ?? "per_session",
    });
  }, [activeFinancial, financialDialogOpen]);

  const resetForm = () => {
    setEditingSession(null);
    setForm({
      ...EMPTY_FORM,
      tutorId: defaultTutorId ?? tutorOptions[0]?.id ?? "",
    });
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (session: LectureSession) => {
    setEditingSession(session);
    setForm({
      title: session.title,
      description: session.description ?? "",
      startsAt: toLocalInputValue(session.starts_at),
      endsAt: toLocalInputValue(session.ends_at),
      tutorId: session.tutor_id,
      recurrenceFrequency: "none",
      recurrenceInterval: "1",
      occurrencesCount: "4",
    });
    setDialogOpen(true);
  };

  const openNotesDialog = (session: LectureSession) => {
    setNoteSession(session);
    setNoteContent(notesBySession[session.id]?.content ?? "");
    setNoteDialogOpen(true);
  };

  const openFinancialDialog = (session: LectureSession) => {
    setFinancialSession(session);
    setFinancialDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      toast({
        title: "Lecture title required",
        description: "Please enter a lecture title.",
        variant: "destructive",
      });
      return;
    }

    if (!form.startsAt || !form.endsAt) {
      toast({
        title: "Lecture time required",
        description: "Please set the lecture start and end time.",
        variant: "destructive",
      });
      return;
    }

    const startsAt = new Date(form.startsAt).toISOString();
    const endsAt = new Date(form.endsAt).toISOString();
    if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      toast({
        title: "Invalid lecture window",
        description: "The lecture end time must be after the start time.",
        variant: "destructive",
      });
      return;
    }

    if (editingSession) {
      await updateLecture.mutateAsync({
        id: editingSession.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        startsAt,
        endsAt,
      });
    } else {
      const recurrenceActive =
        form.recurrenceFrequency !== "none" &&
        Number(form.occurrencesCount) > 1;

      await createLecture.mutateAsync({
        scopeType,
        classroomId: scopeType === "classroom" ? classroomId ?? undefined : undefined,
        studentId: scopeType === "one_to_one" ? studentId ?? undefined : undefined,
        tutorId: form.tutorId || undefined,
        title: form.title.trim(),
        description: form.description.trim() || null,
        startsAt,
        endsAt,
        recurrenceFrequency:
          recurrenceActive && form.recurrenceFrequency !== "none"
            ? form.recurrenceFrequency
            : null,
        recurrenceInterval: recurrenceActive ? Number(form.recurrenceInterval) || 1 : 1,
        occurrencesCount: recurrenceActive ? Math.max(2, Number(form.occurrencesCount) || 2) : 1,
      });
    }

    setDialogOpen(false);
    resetForm();
  };

  const handleCancel = async (session: LectureSession, mode: "single" | "series") => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        mode === "series"
          ? `Cancel the entire recurring series for "${session.title}"? This will remove every Google Meet event in the series and mark all lectures as cancelled.`
          : `Cancel "${session.title}"? This will remove the Google Meet event and mark the lecture as cancelled.`
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
      const confirmed = window.confirm(
        `Mark "${session.title}" as completed? You can add private tutor notes after this.`
      );
      if (!confirmed) return;
    }

    await completeLecture.mutateAsync(session.id);
  };

  const handleSaveNotes = async () => {
    if (!noteSession) return;

    await saveLectureNote.mutateAsync({
      sessionId: noteSession.id,
      content: noteContent,
    });

    setNoteDialogOpen(false);
    setNoteSession(null);
    setNoteContent("");
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

  const sectionTitle =
    scopeType === "classroom" ? "Lecture sessions" : "One-to-one sessions";
  const scheduleLabel =
    scopeType === "classroom" ? "Schedule lecture" : "Schedule 1:1 session";
  const dialogTitle =
    scopeType === "classroom"
      ? editingSession
        ? "Edit lecture"
        : "Schedule lecture"
      : editingSession
        ? "Edit one-to-one session"
        : "Schedule one-to-one session";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" />
              {sectionTitle}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {canManage && (
            <Button
              className="gap-2"
              onClick={openCreateDialog}
              disabled={Boolean(disableSchedulingReason)}
              title={disableSchedulingReason ?? undefined}
            >
              <Plus className="h-4 w-4" />
              {scheduleLabel}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {disableSchedulingReason && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{disableSchedulingReason}</p>
            </div>
          </div>
        )}

        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {([
              ["active", "Scheduled"],
              ["completed", "Completed"],
              ["cancelled", "Cancelled"],
              ["all", "All"],
            ] as Array<[SessionFilter, string]>).map(([value, label]) => (
              <Button
                key={value}
                variant={sessionFilter === value ? "default" : "outline"}
                size="sm"
                onClick={() => setSessionFilter(value)}
              >
                {label}
              </Button>
            ))}
          </div>
          <div className="relative w-full lg:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search lecture sessions"
              className="pl-9"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((index) => (
              <div key={index} className="h-24 rounded-lg border bg-secondary/30 animate-pulse" />
            ))}
          </div>
        ) : visibleSessions.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            {searchQuery.trim()
              ? "No lecture sessions match the current filters."
              : emptyMessage}
          </div>
        ) : (
          <div className="space-y-3">
            {visibleSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                note={notesBySession[session.id]}
                tutorName={tutorMap.get(session.tutor_id)}
                canManage={canManage}
                canCompleteOutcomes={canCompleteOutcomes}
                canEditPrivateNotes={canEditPrivateNotes}
                canEditMockFinancials={canEditMockFinancials}
                showPrivateNotes={showPrivateNotes}
                onEdit={openEditDialog}
                onCancelSingle={(item) => handleCancel(item, "single")}
                onCancelSeries={(item) => handleCancel(item, "series")}
                onComplete={handleComplete}
                onEditNotes={openNotesDialog}
                onEditFinancials={openFinancialDialog}
              />
            ))}
          </div>
        )}
      </CardContent>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              {editingSession
                ? `Update the Google Meet session for ${targetName}.`
                : `Create a live Google Meet session for ${targetName}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Lecture title</Label>
              <Input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder={
                  scopeType === "classroom"
                    ? `e.g. ${targetName} live lecture`
                    : `e.g. ${targetName} weekly coaching`
                }
              />
            </div>
            {canManage && !defaultTutorId && tutorOptions.length > 0 && !editingSession && (
              <div className="space-y-2">
                <Label>Tutor</Label>
                <Select
                  value={form.tutorId}
                  onValueChange={(value) => setForm((current) => ({ ...current, tutorId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select tutor" />
                  </SelectTrigger>
                  <SelectContent>
                    {tutorOptions.map((tutor) => (
                      <SelectItem key={tutor.id} value={tutor.id}>
                        {tutor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
                rows={3}
                placeholder="Optional lecture details, agenda, or materials."
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Start</Label>
                <Input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, startsAt: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>End</Label>
                <Input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, endsAt: event.target.value }))
                  }
                />
              </div>
            </div>
            {!editingSession && (
              <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
                <div className="space-y-2">
                  <Label>Recurrence</Label>
                  <Select
                    value={form.recurrenceFrequency}
                    onValueChange={(value: "none" | "daily" | "weekly") =>
                      setForm((current) => ({ ...current, recurrenceFrequency: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose recurrence" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Does not repeat</SelectItem>
                      <SelectItem value="daily">Repeat daily</SelectItem>
                      <SelectItem value="weekly">Repeat weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.recurrenceFrequency !== "none" && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Repeat every</Label>
                      <Input
                        type="number"
                        min={1}
                        value={form.recurrenceInterval}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            recurrenceInterval: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Occurrences</Label>
                      <Input
                        type="number"
                        min={2}
                        max={24}
                        value={form.occurrencesCount}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            occurrencesCount: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Recurring sessions create separate Google Meet events for each occurrence.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createLecture.isPending || updateLecture.isPending}
            >
              {editingSession
                ? updateLecture.isPending
                  ? "Saving..."
                  : "Save changes"
                : createLecture.isPending
                  ? "Scheduling..."
                  : scheduleLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={financialDialogOpen}
        onOpenChange={(open) => {
          setFinancialDialogOpen(open);
          if (!open) {
            setFinancialSession(null);
            setFinancialForm(EMPTY_FINANCIAL_FORM);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mock pricing inputs</DialogTitle>
            <DialogDescription>
              These values are used only for preview payroll and billing summaries.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
              <p className="text-sm font-medium">Tutor payroll preview</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Rate type</Label>
                  <Select
                    value={financialForm.tutorRateType}
                    onValueChange={(value: TutorRateType) =>
                      setFinancialForm((current) => ({ ...current, tutorRateType: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
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
                    onChange={(event) =>
                      setFinancialForm((current) => ({
                        ...current,
                        tutorRateAmount: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Input
                    value={financialForm.tutorRateCurrency}
                    onChange={(event) =>
                      setFinancialForm((current) => ({
                        ...current,
                        tutorRateCurrency: event.target.value.toUpperCase(),
                      }))
                    }
                    maxLength={8}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
              <p className="text-sm font-medium">Student billing preview</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Charge type</Label>
                  <Select
                    value={financialForm.studentChargeType}
                    onValueChange={(value: StudentChargeType) =>
                      setFinancialForm((current) => ({
                        ...current,
                        studentChargeType: value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
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
                    onChange={(event) =>
                      setFinancialForm((current) => ({
                        ...current,
                        studentChargeAmount: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Input
                    value={financialForm.studentChargeCurrency}
                    onChange={(event) =>
                      setFinancialForm((current) => ({
                        ...current,
                        studentChargeCurrency: event.target.value.toUpperCase(),
                      }))
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
              {saveLectureFinancial.isPending ? "Saving..." : "Save mock inputs"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={noteDialogOpen}
        onOpenChange={(open) => {
          setNoteDialogOpen(open);
          if (!open) {
            setNoteSession(null);
            setNoteContent("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Private tutor notes</DialogTitle>
            <DialogDescription>
              These notes are visible to the assigned tutor and workspace owners only.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label>Notes</Label>
            <Textarea
              value={noteContent}
              onChange={(event) => setNoteContent(event.target.value)}
              rows={8}
              placeholder="Summarize what was covered, student progress, next steps, or follow-up actions."
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
    </Card>
  );
}
