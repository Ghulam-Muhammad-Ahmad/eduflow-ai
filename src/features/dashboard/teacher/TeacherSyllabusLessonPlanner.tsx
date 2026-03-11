"use client";

import { useState, useCallback } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { useSyllabusLessonPlanner, type TeachingLevel, type TeachingStyle } from "@/hooks/useSyllabusLessonPlanner";
import { useAuth } from "@/hooks/useAuth";
import { useAIUsage } from "@/hooks/useAIUsage";
import {
  Sparkles,
  Download,
  Calendar,
  Save,
  RefreshCw,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  GraduationCap,
  Clock,
  Zap,
  FileText,
  FolderOpen,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { DocCenterMini, type DocCenterSelection } from "@/components/ai/DocCenterMini";

const STEPS = [
  { id: 1, title: "Content", short: "What to teach", icon: BookOpen },
  { id: 2, title: "Class & subject", short: "Who & what", icon: GraduationCap },
  { id: 3, title: "Schedule", short: "Time & days", icon: Clock },
  { id: 4, title: "Generate", short: "Review & create", icon: Zap },
] as const;

const TEACHING_LEVELS: { value: TeachingLevel; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

const TEACHING_STYLES: { value: TeachingStyle; label: string }[] = [
  { value: "concept-based", label: "Concept-based" },
  { value: "practice-heavy", label: "Practice-heavy" },
  { value: "revision-focused", label: "Revision-focused" },
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Doc Center formats supported for syllabus. PDF is sent as base64 to the AI; others are extracted to text. */
const SYLLABUS_DOC_FORMATS = ["pdf", "txt", "doc", "docx"];

export default function TeacherSyllabusLessonPlanner() {
  const { user } = useAuth();
  const { usage, isNearLimit } = useAIUsage();
  const {
    contentText,
    setContentText,
    setContentFromDocument,
    setContentFromPdf,
    contentPdfBase64,
    contentPdfFileName,
    extractingDoc,
    subject,
    setSubject,
    gradeLevel,
    setGradeLevel,
    curriculum,
    setCurriculum,
    teachingLevel,
    setTeachingLevel,
    totalWeeks,
    setTotalWeeks,
    hoursPerWeek,
    setHoursPerWeek,
    classDurationMinutes,
    setClassDurationMinutes,
    daysAvailable,
    setDaysAvailable,
    teachingStyle,
    setTeachingStyle,
    plan,
    setPlan,
    loading,
    generate,
    regenerate,
    savePlan,
    scheduleToCalendar,
    downloadPlanPdf,
  } = useSyllabusLessonPlanner();

  const [currentStep, setCurrentStep] = useState(1);
  const [docCenterOpen, setDocCenterOpen] = useState(false);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [editPrompt, setEditPrompt] = useState("");
  const [editingLessonIndex, setEditingLessonIndex] = useState<number | null>(null);
  const [editLessonTitle, setEditLessonTitle] = useState("");
  const [editLessonNotes, setEditLessonNotes] = useState("");

  const handleDocCenterSelect = useCallback(
    async (selection: DocCenterSelection) => {
      if (selection.type === "document") {
        setContentFromDocument(selection.doc.id);
        setDocCenterOpen(false);
        toast.success(`Using "${selection.doc.name}"`);
        return;
      }
      const file = selection.file;
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!SYLLABUS_DOC_FORMATS.includes(ext)) {
        toast.error(`Lesson Planner allows: ${SYLLABUS_DOC_FORMATS.map((f) => f.toUpperCase()).join(", ")}.`);
        return;
      }
      setLoadingDoc(true);
      try {
        const bytes = await file.arrayBuffer();
        const arr = new Uint8Array(bytes);
        let binary = "";
        const chunk = 8192;
        for (let i = 0; i < arr.length; i += chunk) {
          binary += String.fromCharCode(...arr.subarray(i, i + chunk));
        }
        const base64 = btoa(binary);
        if (ext === "pdf") {
          setContentFromPdf(base64, file.name);
          setDocCenterOpen(false);
          toast.success(`Using PDF as-is: "${file.name}"`);
        } else {
          const res = await fetch("/api/documents/extract-file", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ base64, fileName: file.name }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Extraction failed");
          setContentText(data.text?.trim() ?? "");
          setDocCenterOpen(false);
          toast.success(`Using "${data.name ?? file.name}"`);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not process file.");
      } finally {
        setLoadingDoc(false);
      }
    },
    [setContentFromDocument, setContentText, setContentFromPdf]
  );

  const toggleDay = useCallback((day: string) => {
    setDaysAvailable((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }, [setDaysAvailable]);

  const hasContent = contentText.trim().length > 0 || (contentPdfBase64 != null && contentPdfBase64.length > 0);
  const canProceedFromStep1 = hasContent;
  const canProceedFromStep2 = subject.trim().length > 0;
  const canGenerate = canProceedFromStep1 && canProceedFromStep2;

  const goNext = useCallback(() => {
    if (currentStep < 4) setCurrentStep((s) => s + 1);
  }, [currentStep]);

  const goBack = useCallback(() => {
    if (currentStep > 1) setCurrentStep((s) => s - 1);
  }, [currentStep]);

  const handleRegenerate = useCallback(() => {
    if (!editPrompt.trim()) return;
    regenerate(editPrompt);
    setRegenerateOpen(false);
    setEditPrompt("");
  }, [editPrompt, regenerate]);

  const startEditLesson = useCallback(
    (index: number) => {
      const lesson = plan?.lessons[index];
      if (!lesson) return;
      setEditingLessonIndex(index);
      setEditLessonTitle(lesson.title);
      setEditLessonNotes(lesson.teachingNotes ?? lesson.activities ?? "");
    },
    [plan]
  );

  const saveEditLesson = useCallback(() => {
    if (plan == null || editingLessonIndex == null) return;
    const next = [...plan.lessons];
    next[editingLessonIndex] = {
      ...next[editingLessonIndex],
      title: editLessonTitle,
      teachingNotes: editLessonNotes || undefined,
    };
    setPlan({ ...plan, lessons: next });
    setEditingLessonIndex(null);
  }, [plan, editingLessonIndex, editLessonTitle, editLessonNotes, setPlan]);

  const confidenceIcon = () => {
    if (!plan?.confidence) return null;
    switch (plan.confidence) {
      case "full":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "tight":
        return <AlertTriangle className="h-4 w-4 text-amber-600" />;
      case "insufficient":
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return null;
    }
  };

  const handleGenerate = useCallback(async () => {
    await generate();
    // Stay on step 4 to show result
  }, [generate]);

  return (
    <DashboardLayout>
      <div className="mx-auto space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Lesson Planner</h1>
            <p className="text-muted-foreground mt-1">
              Turn syllabus into a scheduled plan in a few steps.
            </p>
          </div>
          {isNearLimit() && (
            <Badge variant="destructive">{usage?.remaining} AI requests left</Badge>
          )}
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-between gap-2">
          {STEPS.map((step, i) => {
            const StepIcon = step.icon;
            const isActive = currentStep === step.id;
            const isPast = currentStep > step.id;
            const isClickable = step.id < 4 || plan != null;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => isClickable && setCurrentStep(step.id)}
                className={`
                  flex flex-1 items-center gap-2 rounded-lg px-3 py-2.5 text-left transition-all
                  ${isActive ? "bg-primary text-primary-foreground shadow" : ""}
                  ${isPast ? "bg-primary/10 text-primary" : ""}
                  ${!isActive && !isPast ? "bg-muted/50 text-muted-foreground hover:bg-muted" : ""}
                  ${isClickable ? "cursor-pointer" : "cursor-default"}
                `}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20">
                  <StepIcon className="h-4 w-4" />
                </span>
                <span className="hidden sm:inline font-medium">{step.title}</span>
                {i < STEPS.length - 1 && (
                  <ChevronRight className="h-4 w-4 ml-auto opacity-50" />
                )}
              </button>
            );
          })}
        </div>

        {/* Step content card */}
        <Card className="overflow-hidden min-h-[320px]">
          {/* Step 1: Content */}
          {currentStep === 1 && (
            <div className="p-6 sm:p-8 space-y-6 animate-in fade-in-0 duration-200">
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  What do you want to teach?
                </h2>
                <p className="text-muted-foreground mt-1">
                  Add your syllabus, topic list, or chapter headings. Pick from Doc Center or paste below. PDFs are sent as-is to the AI; other formats are converted to text.
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm text-muted-foreground">From Doc Center (optional)</Label>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDocCenterOpen(true)}
                      disabled={extractingDoc || loadingDoc}
                    >
                      {(extractingDoc || loadingDoc) ? (
                        <Spinner size="sm" className="mr-1.5" />
                      ) : (
                        <FolderOpen className="h-4 w-4 mr-1.5" />
                      )}
                      Choose from Doc Center
                    </Button>
                  </div>
                  <DocCenterMini
                    open={docCenterOpen}
                    onOpenChange={setDocCenterOpen}
                    onSelect={handleDocCenterSelect}
                    allowedFormats={SYLLABUS_DOC_FORMATS}
                  />
                  {(extractingDoc || loadingDoc) && (
                    <span className="inline-flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                      <Spinner size="sm" /> Extracting text…
                    </span>
                  )}
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Paste or edit content</Label>
                  <Textarea
                    value={contentText}
                    onChange={(e) => setContentText(e.target.value)}
                    placeholder="Paste syllabus, list of topics, or chapter titles..."
                    rows={8}
                    className="mt-2 resize-none"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={goNext} disabled={!canProceedFromStep1}>
                  Next: Class & subject
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Class & subject */}
          {currentStep === 2 && (
            <div className="p-6 sm:p-8 space-y-6 animate-in fade-in-0 duration-200">
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-primary" />
                  Class & subject
                </h2>
                <p className="text-muted-foreground mt-1">
                  Helps the AI match depth and pacing.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Subject *</Label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Mathematics, Biology"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Class / Grade</Label>
                  <Input
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(e.target.value)}
                    placeholder="e.g. Grade 10"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Curriculum (optional)</Label>
                  <Input
                    value={curriculum}
                    onChange={(e) => setCurriculum(e.target.value)}
                    placeholder="Board / university / custom"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Teaching level</Label>
                  <Select value={teachingLevel || "_"} onValueChange={(v: string) => setTeachingLevel((v === "_" ? "" : v) as TeachingLevel)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_">—</SelectItem>
                      {TEACHING_LEVELS.map((l) => (
                        <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={goBack}>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button onClick={goNext} disabled={!canProceedFromStep2}>
                  Next: Schedule
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Schedule */}
          {currentStep === 3 && (
            <div className="p-6 sm:p-8 space-y-6 animate-in fade-in-0 duration-200">
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Time & schedule
                </h2>
                <p className="text-muted-foreground mt-1">
                  How much time do you have? The plan will fit your constraints.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Total weeks</Label>
                  <Input
                    type="number"
                    min={1}
                    max={52}
                    value={totalWeeks}
                    onChange={(e) => setTotalWeeks(Number(e.target.value) || 1)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hours per week</Label>
                  <Input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={hoursPerWeek}
                    onChange={(e) => setHoursPerWeek(Number(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Class duration (min)</Label>
                  <Input
                    type="number"
                    min={15}
                    step={15}
                    value={classDurationMinutes}
                    onChange={(e) => setClassDurationMinutes(Number(e.target.value) || 60)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Teaching style (optional)</Label>
                <Select value={teachingStyle || "_"} onValueChange={(v: string) => setTeachingStyle((v === "_" ? "" : v) as TeachingStyle)}>
                  <SelectTrigger className="max-w-xs">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_">—</SelectItem>
                    {TEACHING_STYLES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Days you teach</Label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((day) => (
                    <Button
                      key={day}
                      type="button"
                      variant={daysAvailable.includes(day) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleDay(day)}
                    >
                      {day.slice(0, 3)}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={goBack}>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button onClick={goNext}>
                  Next: Generate
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Review & generate OR result */}
          {currentStep === 4 && !plan && (
            <div className="p-6 sm:p-8 space-y-6 animate-in fade-in-0 duration-200">
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Review & generate
                </h2>
                <p className="text-muted-foreground mt-1">
                  Summary of your choices. Click Generate to create your lesson plan.
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3 text-sm">
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-28 shrink-0">Content</span>
                  <span className="line-clamp-2">
                    {contentPdfFileName ? `PDF: ${contentPdfFileName} (sent as-is)` : contentText.length > 120 ? `${contentText.slice(0, 120)}…` : contentText}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-28 shrink-0">Subject</span>
                  <span>{subject}{gradeLevel ? ` · ${gradeLevel}` : ""}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-28 shrink-0">Schedule</span>
                  <span>{totalWeeks} weeks, {hoursPerWeek}h/week, {classDurationMinutes} min per class · {daysAvailable.join(", ")}</span>
                </div>
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={goBack}>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button onClick={handleGenerate} disabled={!canGenerate || loading}>
                  {loading ? (
                    <Spinner size="sm" className="mr-2" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Generate lesson plan
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Plan result */}
          {currentStep === 4 && plan && (
            <div className="p-6 sm:p-8 space-y-6 animate-in fade-in-0 duration-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Your lesson plan
                </h2>
                <div className="flex items-center gap-2">
                  {confidenceIcon()}
                  <Badge variant={plan.confidence === "full" ? "default" : plan.confidence === "tight" ? "secondary" : "destructive"}>
                    {plan.confidence}
                  </Badge>
                </div>
              </div>
              {plan.summary && (
                <p className="text-sm text-muted-foreground">{plan.summary}</p>
              )}
              {plan.message && (
                <p className="text-sm text-amber-700 dark:text-amber-400">{plan.message}</p>
              )}

              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-2 w-12">#</th>
                      <th className="text-left p-2">Lesson</th>
                      <th className="text-left p-2 w-24">Duration</th>
                      <th className="text-left p-2">Topics</th>
                      <th className="text-left p-2">Notes</th>
                      <th className="w-20" />
                    </tr>
                  </thead>
                  <tbody>
                    {plan.lessons.map((lesson, index) => (
                      <tr key={lesson.lessonNo} className="border-b">
                        <td className="p-2">{lesson.lessonNo}</td>
                        <td className="p-2">
                          {editingLessonIndex === index ? (
                            <Input
                              value={editLessonTitle}
                              onChange={(e) => setEditLessonTitle(e.target.value)}
                              className="h-8"
                            />
                          ) : (
                            lesson.title
                          )}
                        </td>
                        <td className="p-2">{lesson.durationMinutes} min</td>
                        <td className="p-2">{(lesson.topics ?? []).join(", ") || "—"}</td>
                        <td className="p-2 max-w-[200px] truncate">
                          {editingLessonIndex === index ? (
                            <Input
                              value={editLessonNotes}
                              onChange={(e) => setEditLessonNotes(e.target.value)}
                              placeholder="Notes"
                              className="h-8"
                            />
                          ) : (
                            lesson.teachingNotes ?? lesson.activities ?? "—"
                          )}
                        </td>
                        <td className="p-2">
                          {editingLessonIndex === index ? (
                            <Button size="sm" variant="ghost" onClick={saveEditLesson}>Save</Button>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => startEditLesson(index)}>
                              <Edit3 className="h-3 w-3" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {plan.weeklyDistribution && Object.keys(plan.weeklyDistribution).length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Weekly distribution</h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(plan.weeklyDistribution).map(([week, nums]) => (
                      <Badge key={week} variant="outline">
                        {week}: {nums.join(", ")}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" onClick={() => setRegenerateOpen(true)}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate with instructions
                </Button>
                <Button variant="outline" size="sm" onClick={savePlan}>
                  <Save className="h-4 w-4 mr-2" />
                  Save plan
                </Button>
                <Button variant="outline" size="sm" onClick={downloadPlanPdf}>
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
                <Button size="sm" onClick={scheduleToCalendar}>
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule to calendar
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Dialog open={regenerateOpen} onOpenChange={setRegenerateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate plan</DialogTitle>
            <DialogDescription>
              Describe how you want to change the plan (e.g. &quot;add more practice&quot;, &quot;skip chapter 3&quot;).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={editPrompt}
            onChange={(e) => setEditPrompt(e.target.value)}
            placeholder="Your instructions..."
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegenerateOpen(false)}>Cancel</Button>
            <Button onClick={handleRegenerate} disabled={!editPrompt.trim() || loading}>
              {loading ? <Spinner size="sm" /> : "Regenerate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      </DashboardLayout>
  );
}
