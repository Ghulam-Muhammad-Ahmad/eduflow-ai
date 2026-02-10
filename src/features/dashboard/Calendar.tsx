"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Sparkles,
  Plus,
  Calendar as CalendarIcon,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  CalendarPlus,
  ClipboardList,
  Clock,
  FileText,
  Pencil,
  Trash2,
  BookOpen,
} from "lucide-react";
import usePlannerCalendar from "@/hooks/usePlannerCalendar";
import type { PlannerEvent } from "@/hooks/usePlannerCalendar";
import { useAIUsage } from "@/hooks/useAIUsage";
import { useToast } from "@/hooks/use-toast";
import { Calendar as BigCalendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, startOfMonth, endOfMonth, addMonths } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import type { CalendarEventSuggestion } from "@/services/aiService";
import "react-big-calendar/lib/css/react-big-calendar.css";

const locales = { "en-US": enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

// Map DB events to react-big-calendar format
function toCalendarEvent(e: PlannerEvent) {
  return {
    id: e.id,
    title: e.title,
    start: new Date(e.start_at),
    end: new Date(e.end_at),
    allDay: e.all_day,
    resource: e,
  };
}

// Custom toolbar: month view only — navigation and label
function CalendarToolbar({
  label,
  onNavigate,
}: {
  label: string;
  onNavigate: (action: string) => void;
  onView?: (view: string) => void;
  view?: string;
  views?: string[];
}) {
  return (
    <div className="rbc-toolbar flex flex-wrap items-center justify-center gap-4 py-3 sm:justify-between">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="p-0 m-0 border-0 flex items-center justify-center calender-arrow"
          onClick={() => onNavigate("PREV")}
        >
          <ChevronLeft className="h-8 w-8" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onNavigate("TODAY")}
        >
          Today
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="p-0 m-0 border-0 flex items-center justify-center calender-arrow"
          onClick={() => onNavigate("NEXT")}
        >
          <ChevronRight className="h-8 w-8" />
        </Button>
      </div>
      <h3 className="text-lg font-semibold text-foreground min-w-[200px] text-center">{label}</h3>
      <div className="w-[120px]" aria-hidden />
    </div>
  );
}

export default function Calendar() {
  const { usage, isNearLimit } = useAIUsage();
  const {
    events,
    loading,
    suggesting,
    fetchEvents,
    addEvent,
    addEvents,
    updateEvent,
    deleteEvent,
    suggestEvents,
  } = usePlannerCalendar();
  const { toast } = useToast();

  const [date, setDate] = useState(new Date());
  const [aiPrompt, setAiPrompt] = useState("");
  const [suggestedEvents, setSuggestedEvents] = useState<CalendarEventSuggestion[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [addEventOpen, setAddEventOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [manualTitle, setManualTitle] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [manualStart, setManualStart] = useState("");
  const [manualEnd, setManualEnd] = useState("");
  const [manualAllDay, setManualAllDay] = useState(false);
  const [detailEvent, setDetailEvent] = useState<PlannerEvent | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editAllDay, setEditAllDay] = useState(false);

  const calendarEvents = useMemo(() => events.map(toCalendarEvent), [events]);

  // One-time initial fetch so events load even if Calendar hasn't fired onRangeChange yet
  const hasFetchedInitial = useRef(false);
  useEffect(() => {
    if (hasFetchedInitial.current) return;
    hasFetchedInitial.current = true;
    const start = startOfMonth(new Date());
    const end = endOfMonth(addMonths(new Date(), 2));
    fetchEvents(start, end);
  }, [fetchEvents]);

  const onRangeChange = useCallback(
    (range: Date[] | { start: Date; end: Date }) => {
      const start = Array.isArray(range) ? range[0] : range.start;
      const end = Array.isArray(range) ? range[range.length - 1] : range.end;
      if (start && end) fetchEvents(start, end);
    },
    [fetchEvents]
  );

  const handleSelectSlot = useCallback((slot: { start: Date; end: Date }) => {
    setSelectedSlot(slot);
    setManualStart(format(slot.start, "yyyy-MM-dd'T'HH:mm"));
    setManualEnd(format(slot.end, "yyyy-MM-dd'T'HH:mm"));
    setManualTitle("");
    setManualDescription("");
    setManualAllDay(false);
    setAddEventOpen(true);
  }, []);

  const handleSelectEvent = useCallback((event: { resource?: PlannerEvent }) => {
    const ev = event?.resource;
    if (ev) {
      setDetailEvent(ev);
      setEditTitle(ev.title);
      setEditDescription(ev.description ?? "");
      setEditStart(format(new Date(ev.start_at), "yyyy-MM-dd'T'HH:mm"));
      setEditEnd(format(new Date(ev.end_at), "yyyy-MM-dd'T'HH:mm"));
      setEditAllDay(ev.all_day);
      setEditingEventId(null);
      setDetailOpen(true);
    }
  }, []);

  const startEditingDetail = useCallback(() => {
    setEditingEventId(detailEvent?.id ?? null);
  }, [detailEvent?.id]);

  const cancelEditingDetail = useCallback(() => {
    setEditingEventId(null);
    if (detailEvent) {
      setEditTitle(detailEvent.title);
      setEditDescription(detailEvent.description ?? "");
      setEditStart(format(new Date(detailEvent.start_at), "yyyy-MM-dd'T'HH:mm"));
      setEditEnd(format(new Date(detailEvent.end_at), "yyyy-MM-dd'T'HH:mm"));
      setEditAllDay(detailEvent.all_day);
    }
  }, [detailEvent]);

  const saveEditingDetail = useCallback(async () => {
    if (!detailEvent || !editingEventId) return;
    await updateEvent(detailEvent.id, {
      title: editTitle.trim(),
      description: editDescription.trim() || null,
      start_at: new Date(editStart).toISOString(),
      end_at: new Date(editEnd).toISOString(),
      all_day: editAllDay,
    });
    setDetailEvent((prev) =>
      prev && prev.id === detailEvent.id
        ? {
          ...prev,
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          start_at: new Date(editStart).toISOString(),
          end_at: new Date(editEnd).toISOString(),
          all_day: editAllDay,
        }
        : prev
    );
    setEditingEventId(null);
  }, [detailEvent, editingEventId, editTitle, editDescription, editStart, editEnd, editAllDay, updateEvent]);

  const handleDeleteDetailEvent = useCallback(async () => {
    if (!detailEvent) return;
    await deleteEvent(detailEvent.id);
    setDetailOpen(false);
    setDetailEvent(null);
    setEditingEventId(null);
  }, [detailEvent, deleteEvent]);

  const handleAddManualEvent = useCallback(async () => {
    if (!manualTitle.trim()) {
      toast({ title: "Enter a title", variant: "destructive" });
      return;
    }
    const start = manualStart
      || (selectedSlot ? format(selectedSlot.start, "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    const end = manualEnd
      || (selectedSlot ? format(selectedSlot.end, "yyyy-MM-dd'T'HH:mm") : format(new Date(Date.now() + 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm"));
    await addEvent({
      title: manualTitle.trim(),
      description: manualDescription.trim() || null,
      start_at: new Date(start).toISOString(),
      end_at: new Date(end).toISOString(),
      all_day: manualAllDay,
    });
    setAddEventOpen(false);
    setManualTitle("");
    setManualDescription("");
    setSelectedSlot(null);
  }, [manualTitle, manualDescription, manualStart, manualEnd, manualAllDay, selectedSlot, addEvent, toast]);

  const handleSuggestWithAI = useCallback(async () => {
    if (!aiPrompt.trim()) {
      toast({ title: "Describe the events you want", variant: "destructive" });
      return;
    }
    const list = await suggestEvents(aiPrompt.trim());
    if (list.length > 0) {
      setSuggestedEvents(list);
      setReviewOpen(true);
    }
  }, [aiPrompt, suggestEvents, toast]);

  const [editingSuggestions, setEditingSuggestions] = useState<CalendarEventSuggestion[]>([]);
  const prevReviewOpen = useRef(false);

  useEffect(() => {
    if (reviewOpen && !prevReviewOpen.current && suggestedEvents.length > 0) {
      setEditingSuggestions(suggestedEvents.map((e) => ({ ...e })));
    }
    prevReviewOpen.current = reviewOpen;
  }, [reviewOpen, suggestedEvents]);

  const updateSuggestion = useCallback((index: number, field: keyof CalendarEventSuggestion, value: string | boolean) => {
    setEditingSuggestions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }, []);

  const removeSuggestion = useCallback((index: number) => {
    setEditingSuggestions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const addSelectedToCalendar = useCallback(async () => {
    const toAdd = editingSuggestions.map((e) => ({
      title: e.title,
      start_at: e.start,
      end_at: e.end,
      all_day: e.allDay ?? false,
      description: e.description ?? null,
    }));
    await addEvents(toAdd);
    setReviewOpen(false);
    setSuggestedEvents([]);
    setEditingSuggestions([]);
    setAiPrompt("");
  }, [editingSuggestions, addEvents]);

  const handleCloseReview = useCallback(() => {
    setReviewOpen(false);
    setSuggestedEvents([]);
    setEditingSuggestions([]);
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-2 w-full min-w-0 max-w-full overflow-hidden">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {isNearLimit() && (
            <Badge variant="destructive">
              {usage?.remaining} AI requests remaining
            </Badge>
          )}
        </div>

        {/* AI: describe events → suggest → review before adding */}
        <Card className="p-4 border-primary/10 bg-gradient-to-br from-primary/5 to-transparent">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Input
                placeholder="e.g. Daily for next 10 days at 10pm, or Every Monday 9am for the next month"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className="mt-1"
              />
            </div>
            <Button
              onClick={handleSuggestWithAI}
              disabled={suggesting || !aiPrompt.trim()}
              className="gap-2"
            >
              {suggesting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Suggest with AI
            </Button>
          </div>
        </Card>

        {/* Calendar + Add event */}
        <Card className="p-4 w-full min-w-0 overflow-hidden">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <CalendarIcon className="h-5 w-5 text-primary shrink-0" />
              Calendar
            </h2>
            <Button
              onClick={() => { setSelectedSlot(null); setManualStart(""); setManualEnd(""); setManualTitle(""); setManualDescription(""); setAddEventOpen(true); }}
              className="gap-2 w-full sm:w-auto"
            >
              <CalendarPlus className="h-4 w-4" />
              Add event
            </Button>
          </div>
          <div className="relative w-full min-w-0 h-[min(800px,calc(100vh-14rem))] min-h-[320px]">
            <div className="teacher-calendar-wrapper rounded-lg bg-card overflow-hidden h-full w-full min-w-0 absolute inset-0">
              {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 rounded-lg">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
              <BigCalendar
                  localizer={localizer}
                  events={calendarEvents}
                  startAccessor="start"
                  endAccessor="end"
                  view="month"
                  date={date}
                  onNavigate={setDate}
                  onRangeChange={onRangeChange}
                  onSelectSlot={handleSelectSlot}
                  onSelectEvent={handleSelectEvent}
                  selectable
                  popup
                  views={["month"]}
                  style={{ height: "100%", minHeight: 0 }}
                  eventPropGetter={() => ({
                    style: {
                      backgroundColor: "hsl(var(--primary))",
                      borderColor: "hsl(var(--primary))",
                      color: "hsl(var(--primary-foreground))",
                      borderRadius: "6px",
                    },
                  })}
                  components={{
                    toolbar: CalendarToolbar,
                  }}
                />
            </div>
          </div>
        </Card>
      </div>

      {/* Review AI-suggested events: edit and customize before adding */}
      <Dialog open={reviewOpen} onOpenChange={(open) => { if (!open) handleCloseReview(); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Review suggested events
            </DialogTitle>
            <DialogDescription>
              Edit or remove any event below, then add the ones you want to your calendar.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 min-h-0 space-y-3 py-2">
            {editingSuggestions.map((e, i) => (
              <Card key={i} className="p-3 space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <div className="grid gap-2 flex-1 grid-cols-1 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">Title</Label>
                      <Input
                        value={e.title}
                        onChange={(ev) => updateSuggestion(i, "title", ev.target.value)}
                        placeholder="Event title"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs whitespace-nowrap">All day</Label>
                      <input
                        type="checkbox"
                        checked={!!e.allDay}
                        onChange={(ev) => updateSuggestion(i, "allDay", ev.target.checked)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Start</Label>
                      <Input
                        type="datetime-local"
                        value={e.start.slice(0, 16)}
                        onChange={(ev) => updateSuggestion(i, "start", new Date(ev.target.value).toISOString())}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">End</Label>
                      <Input
                        type="datetime-local"
                        value={e.end.slice(0, 16)}
                        onChange={(ev) => updateSuggestion(i, "end", new Date(ev.target.value).toISOString())}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Description (optional)</Label>
                    <Textarea
                      value={e.description ?? ""}
                      onChange={(ev) => updateSuggestion(i, "description", ev.target.value)}
                      placeholder="Details or notes for this event"
                      rows={2}
                      className="resize-none mt-1"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSuggestion(i)}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label="Remove suggestion"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseReview}>
              Cancel
            </Button>
            <Button
              onClick={addSelectedToCalendar}
              disabled={!editingSuggestions.length}
              className="gap-2"
            >
              <CalendarPlus className="h-4 w-4" />
              Add to calendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Event detail: view / edit */}
      <Dialog open={detailOpen} onOpenChange={(open) => { if (!open) { setDetailOpen(false); setDetailEvent(null); setEditingEventId(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingEventId ? (
                <>
                  <Pencil className="h-5 w-5 text-primary" />
                  Edit event
                </>
              ) : (
                <>
                  <BookOpen className="h-5 w-5 text-primary" />
                  Event details
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {editingEventId ? "Update the event and save." : "View or edit this calendar event."}
            </DialogDescription>
          </DialogHeader>
          {detailEvent && (
            <div className="space-y-4 py-2">
              {editingEventId ? (
                <>
                  <div>
                    <Label className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      Title
                    </Label>
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Event title"
                    />
                  </div>
                  <div>
                    <Label className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      Description (optional)
                    </Label>
                    <Textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Details or notes"
                      rows={3}
                      className="resize-none mt-1"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="detail-allday"
                      checked={editAllDay}
                      onChange={(e) => setEditAllDay(e.target.checked)}
                    />
                    <Label htmlFor="detail-allday">All day</Label>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        Start
                      </Label>
                      <Input
                        type="datetime-local"
                        value={editStart}
                        onChange={(e) => setEditStart(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        End
                      </Label>
                      <Input
                        type="datetime-local"
                        value={editEnd}
                        onChange={(e) => setEditEnd(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" />
                      Title
                    </p>
                    <p className="text-base font-medium mt-0.5">{detailEvent.title}</p>
                  </div>
                  {(detailEvent.description ?? "").trim() ? (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" />
                        Description
                      </p>
                      <p className="text-sm whitespace-pre-wrap rounded-md bg-muted/50 p-3 mt-0.5">{detailEvent.description}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No description.</p>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-start gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-muted-foreground">Start</p>
                        <p>{format(new Date(detailEvent.start_at), "PPp")}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-muted-foreground">End</p>
                        <p>{format(new Date(detailEvent.end_at), "PPp")}</p>
                      </div>
                    </div>
                  </div>
                  {detailEvent.all_day && <Badge variant="secondary">All day</Badge>}
                </>
              )}
            </div>
          )}
          <DialogFooter>
            {editingEventId ? (
              <>
                <Button variant="outline" onClick={cancelEditingDetail}>Cancel</Button>
                <Button onClick={saveEditingDetail}>Save</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => detailEvent && handleDeleteDetailEvent()} className="gap-2 text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
                <Button variant="outline" onClick={startEditingDetail} className="gap-2">
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
                <Button onClick={() => setDetailOpen(false)}>Close</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual add event */}
      <Dialog open={addEventOpen} onOpenChange={setAddEventOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarPlus className="h-5 w-5 text-primary" />
              Add event
            </DialogTitle>
            <DialogDescription>Create an event on your calendar.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="ev-title" className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Title
              </Label>
              <Input
                id="ev-title"
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                placeholder="e.g. Math block"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="ev-desc" className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Description (optional)
              </Label>
              <Textarea
                id="ev-desc"
                value={manualDescription}
                onChange={(e) => setManualDescription(e.target.value)}
                placeholder="Details, notes, or materials for this event"
                rows={3}
                className="resize-none mt-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="ev-allday"
                checked={manualAllDay}
                onChange={(e) => setManualAllDay(e.target.checked)}
              />
              <Label htmlFor="ev-allday">All day</Label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="ev-start" className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Start
                </Label>
                <Input
                  id="ev-start"
                  type="datetime-local"
                  value={manualStart}
                  onChange={(e) => setManualStart(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="ev-end" className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  End
                </Label>
                <Input
                  id="ev-end"
                  type="datetime-local"
                  value={manualEnd}
                  onChange={(e) => setManualEnd(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddEventOpen(false)}>Cancel</Button>
            <Button onClick={handleAddManualEvent} className="gap-2">
              <CalendarPlus className="h-4 w-4" />
              Add event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
