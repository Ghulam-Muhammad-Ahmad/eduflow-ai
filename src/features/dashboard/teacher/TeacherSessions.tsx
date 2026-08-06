import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AmountInput } from "@/components/ui/amount-input";
import { Label } from "@/components/ui/label";
import { parseAmountFromDisplay } from "@/lib/formatAmount";
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
import { useAuth } from "@/hooks/useAuth";
import { useClassrooms } from "@/hooks/useClassrooms";
import { useOneToOneRooms } from "@/hooks/useOneToOneRooms";
import {
  useTeacherAllLectureSessions,
  useCancelLectureSession,
  useUpdateLectureSession,
  useCompleteLectureSession,
  useSaveLectureSessionNote,
  useSaveLectureSessionFinancial,
  useLectureSessionNotes,
  useLectureSessionFinancial,
  type LectureSession,
  type LectureSessionFinancialMock,
  type TutorRateType,
  type StudentChargeType,
} from "@/hooks/useLectureSessions";
import { SessionsListCard } from "@/components/lectures/SessionsListCard";
import { resolveBrowserTimezone, utcIsoToWallClock, wallClockToUtcIso } from "@/lib/timezone";
import { format } from "date-fns";
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

export default function TeacherSessions() {
  const router = useRouter();
  const { user } = useAuth();
  const { classrooms } = useClassrooms();
  const { oneToOneRooms = [] } = useOneToOneRooms();
  const { data: sessions = [], isLoading: sessionsLoading } = useTeacherAllLectureSessions();
  const cancelLecture = useCancelLectureSession();
  const updateLecture = useUpdateLectureSession();
  const completeLecture = useCompleteLectureSession();
  const saveLectureNote = useSaveLectureSessionNote();
  const saveLectureFinancial = useSaveLectureSessionFinancial();
  const { toast } = useToast();

  const classroomIdFromQuery = typeof router.query.classroomId === "string" ? router.query.classroomId : null;

  const [sessionFilter, setSessionFilter] = useState<SessionFilter>("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [scopeFilter, setScopeFilter] = useState<string>(
    classroomIdFromQuery ? `classroom:${classroomIdFromQuery}` : "all"
  );
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<LectureSession | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    startsAt: "",
    endsAt: "",
    timezone: "",
  });
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteSession, setNoteSession] = useState<LectureSession | null>(null);
  const [noteContent, setNoteContent] = useState("");
  const [financialDialogOpen, setFinancialDialogOpen] = useState(false);
  const [financialSession, setFinancialSession] = useState<LectureSession | null>(null);
  const [financialForm, setFinancialForm] = useState<FinancialFormState>(EMPTY_FINANCIAL_FORM);
  const classroomMap = useMemo(
    () => new Map((classrooms ?? []).map((c) => [c.id, c.name])),
    [classrooms]
  );
  const oneToOneRoomOptions = useMemo(
    () =>
      (oneToOneRooms ?? []).map((r) => ({
        id: r.id,
        label: r.name || (r.studentProfile?.display_name ?? "Room"),
      })),
    [oneToOneRooms]
  );

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
      const financial = (activeFinancial as { financial?: LectureSessionFinancialMock | null })?.financial ?? null;
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
      let matchScope = true;
      if (scopeFilter !== "all") {
        if (scopeFilter.startsWith("classroom:")) {
          matchScope = session.classroom_id === scopeFilter.replace("classroom:", "");
        } else if (scopeFilter.startsWith("room:")) {
          const roomId = scopeFilter.replace("room:", "");
          const room = oneToOneRooms.find((r) => r.id === roomId);
          matchScope =
            !!room &&
            (session as { scope_type?: string }).scope_type === "one_to_one" &&
            session.student_id === room.student_id;
        }
      }
      const matchSearch =
        !q ||
        `${session.title} ${session.description ?? ""}`.toLowerCase().includes(q);
      return matchFilter && matchScope && matchSearch;
    });
  }, [orderedSessions, sessionFilter, scopeFilter, searchQuery, oneToOneRooms]);

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
    const tz = session.timezone || resolveBrowserTimezone();
    setEditingSession(session);
    setEditForm({
      title: session.title,
      description: session.description ?? "",
      startsAt: utcIsoToWallClock(session.starts_at, tz),
      endsAt: utcIsoToWallClock(session.ends_at, tz),
      timezone: tz,
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
    // Convert back through the same zone the form was hydrated with, otherwise an
    // untouched save shifts the session by the UTC offset.
    const editTz = editForm.timezone || resolveBrowserTimezone();
    const startsAt = wallClockToUtcIso(editForm.startsAt, editTz);
    const endsAt = wallClockToUtcIso(editForm.endsAt, editTz);
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
      tutorRateAmount: parseAmountFromDisplay(financialForm.tutorRateAmount),
      tutorRateCurrency: financialForm.tutorRateCurrency.trim().toUpperCase() || "GBP",
      tutorRateType: financialForm.tutorRateType,
      studentChargeAmount: parseAmountFromDisplay(financialForm.studentChargeAmount),
      studentChargeCurrency:
        financialForm.studentChargeCurrency.trim().toUpperCase() || "GBP",
      studentChargeType: financialForm.studentChargeType,
    });
    setFinancialDialogOpen(false);
    setFinancialSession(null);
    setFinancialForm(EMPTY_FINANCIAL_FORM);
  };

  const tutorDisplayName = user?.user_metadata?.display_name ?? user?.email?.split("@")[0] ?? "You";

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6 min-w-0 overflow-hidden">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Lecture sessions</h1>
            <p className="text-muted-foreground mt-1">
              Manage your Google Meet lectures. Sessions are scheduled by your workspace owner.
            </p>
          </div>
        </div>

        <SessionsListCard
          role="teacher"
          isLoading={sessionsLoading}
          visibleSessions={visibleSessions}
          sessionFilter={sessionFilter}
          onSessionFilterChange={setSessionFilter}
          scopeFilter={scopeFilter}
          onScopeFilterChange={setScopeFilter}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          classrooms={classrooms ?? []}
          oneToOneRoomOptions={oneToOneRoomOptions}
          classroomMap={classroomMap}
          notesBySession={notesBySession}
          onEdit={openEditDialog}
          onCancelSingle={(s) => handleCancel(s, "single")}
          onCancelSeries={(s) => handleCancel(s, "series")}
          onComplete={handleComplete}
          onEditNotes={openNotesDialog}
          onEditFinancials={openFinancialDialog}
        />
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
            <p className="text-xs text-muted-foreground">
              Times shown in {editForm.timezone || resolveBrowserTimezone()}.
            </p>
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
              Visible to you and workspace owners only.
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

      {/* Financial dialog */}
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
                  <AmountInput
                    value={financialForm.tutorRateAmount}
                    onChange={(v) =>
                      setFinancialForm((f) => ({ ...f, tutorRateAmount: v }))
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
                  <AmountInput
                    value={financialForm.studentChargeAmount}
                    onChange={(v) =>
                      setFinancialForm((f) => ({ ...f, studentChargeAmount: v }))
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

    </DashboardLayout>
  );
}
