"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Trash2,
  GripVertical,
  Save,
  X,
  Check,
  Sparkles,
  ChevronDown,
  ChevronRight,
  ListTodo,
  MessageSquare,
  FileText,
  HelpCircle,
  ArrowUp,
  ArrowDown,
  Clock,
  Target,
  RefreshCw,
  Eye,
  BarChart3,
  Settings2,
  Zap,
  Award,
  Copy,
  Lightbulb,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuizzes, Quiz, QuizQuestion } from "@/hooks/useQuizzes";
import { useClassrooms } from "@/hooks/useClassrooms";
import { useOneToOneRooms } from "@/hooks/useOneToOneRooms";
import { useAIStudio } from "@/hooks/useAIStudio";
import { useToast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from "uuid";
import { AIGenerateQuestionsDialog } from "@/components/quiz/AIGenerateQuestionsDialog";
import { cn } from "@/lib/utils";

// ── Question type config ────────────────────────────────────────────
const QUESTION_TYPE_CONFIG: Record<
  QuizQuestion["question_type"],
  { label: string; shortLabel: string; icon: React.ReactNode; color: string; bgColor: string; borderColor: string }
> = {
  multiple_choice: {
    label: "Multiple Choice",
    shortLabel: "MC",
    icon: <ListTodo className="h-4 w-4" />,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/40",
    borderColor: "border-l-blue-500",
  },
  true_false: {
    label: "True / False",
    shortLabel: "T/F",
    icon: <MessageSquare className="h-4 w-4" />,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/40",
    borderColor: "border-l-emerald-500",
  },
  short_answer: {
    label: "Short Answer",
    shortLabel: "SA",
    icon: <FileText className="h-4 w-4" />,
    color: "text-violet-600 dark:text-violet-400",
    bgColor: "bg-violet-50 dark:bg-violet-950/40",
    borderColor: "border-l-violet-500",
  },
};

const QUESTION_TYPES: {
  value: QuizQuestion["question_type"];
  label: string;
  icon: React.ReactNode;
  description: string;
}[] = [
  {
    value: "multiple_choice",
    label: "Multiple Choice",
    icon: <ListTodo className="h-5 w-5" />,
    description: "Options with one or more correct answers",
  },
  {
    value: "true_false",
    label: "True / False",
    icon: <MessageSquare className="h-5 w-5" />,
    description: "Simple binary choice question",
  },
  {
    value: "short_answer",
    label: "Short Answer",
    icon: <FileText className="h-5 w-5" />,
    description: "Free-text response with sample answer",
  },
];

// ── Option letter helper ────────────────────────────────────────────
const OPTION_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// ── Component ───────────────────────────────────────────────────────
const TeacherQuizBuilder = () => {
  const router = useRouter();
  const { quizId } = router.query;
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    fetchQuizWithQuestions,
    createQuiz,
    updateQuiz,
  } = useQuizzes();
  const { classrooms } = useClassrooms();
  const { oneToOneRooms } = useOneToOneRooms();
  const { loading: aiLoading } = useAIStudio();

  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<number | null>(null);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [targetType, setTargetType] = useState<"classroom" | "1v1">("classroom");
  const [classroomId, setClassroomId] = useState("");
  const [oneToOneRoomId, setOneToOneRoomId] = useState("");
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number | undefined>();
  const [availableFrom, setAvailableFrom] = useState("");
  const [availableUntil, setAvailableUntil] = useState("");
  const [passingScore, setPassingScore] = useState<number>(70);
  const [maxAttempts, setMaxAttempts] = useState<number>(1);
  const [randomizeQuestions, setRandomizeQuestions] = useState(false);
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(true);
  const [showResultsImmediately, setShowResultsImmediately] = useState(true);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loadingQuiz, setLoadingQuiz] = useState(false);

  // ── Derived stats ───────────────────────────────────────────────
  const totalPoints = useMemo(
    () => questions.reduce((sum, q) => sum + (q.points || 0), 0),
    [questions]
  );
  const questionTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    questions.forEach((q) => {
      counts[q.question_type] = (counts[q.question_type] || 0) + 1;
    });
    return counts;
  }, [questions]);

  const hasShortAnswer = useMemo(
    () => questions.some((q) => q.question_type === "short_answer"),
    [questions]
  );

  useEffect(() => {
    if (hasShortAnswer) {
      setShowCorrectAnswers(false);
      setShowResultsImmediately(false);
    }
  }, [hasShortAnswer]);

  const loadQuiz = useCallback(async () => {
    if (!quizId) return;
    setLoadingQuiz(true);
    try {
      const data = await fetchQuizWithQuestions(quizId as string) as { quiz: Quiz | null; questions: QuizQuestion[] } | null;
      if (!data?.quiz) return;
      const { quiz, questions: loadedQuestions } = data;
      setTitle(quiz.title ?? "");
      setDescription(quiz.description ?? "");
      setInstructions(quiz.instructions ?? "");
      setTargetType(quiz.one_to_one_room_id ? "1v1" : "classroom");
      setClassroomId(quiz.classroom_id ?? "");
      setOneToOneRoomId(quiz.one_to_one_room_id ?? "");
      setTimeLimitMinutes(quiz.time_limit_minutes ?? undefined);
      setAvailableFrom(quiz.available_from ? quiz.available_from.slice(0, 16) : "");
      setAvailableUntil(quiz.available_until ? quiz.available_until.slice(0, 16) : "");
      setPassingScore(quiz.passing_score ?? 70);
      setMaxAttempts(quiz.max_attempts ?? 1);
      setRandomizeQuestions(quiz.randomize_questions ?? false);
      setShowCorrectAnswers(quiz.show_correct_answers ?? true);
      setShowResultsImmediately(quiz.show_results_immediately ?? true);
      setQuestions(
        loadedQuestions.map((question) => ({
          ...question,
          id: question.id ?? uuidv4(),
        }))
      );
    } catch (error: unknown) {
      console.error("Error loading quiz:", error);
      toast({
        title: "Failed to load quiz",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
      setTitle("");
      setDescription("");
      setInstructions("");
      setClassroomId("");
      setOneToOneRoomId("");
      setTimeLimitMinutes(undefined);
      setAvailableFrom("");
      setAvailableUntil("");
      setPassingScore(70);
      setMaxAttempts(1);
      setRandomizeQuestions(false);
      setShowCorrectAnswers(true);
      setShowResultsImmediately(true);
      setQuestions([]);
    } finally {
      setLoadingQuiz(false);
    }
  }, [fetchQuizWithQuestions, quizId, toast]);

  useEffect(() => {
    if (quizId) loadQuiz();
  }, [quizId, loadQuiz]);

  const handleAIGenerateQuestions = (newQuestions: QuizQuestion[]) => {
    const withOrder = newQuestions.map((q, i) => ({
      ...q,
      id: q.id ?? uuidv4(),
      order_index: questions.length + i,
    }));
    setQuestions([...questions, ...withOrder]);
    toast({
      title: "Questions added",
      description: `Added ${newQuestions.length} AI-generated question${newQuestions.length > 1 ? "s" : ""}. Review and edit as needed.`,
    });
  };

  const addQuestion = (type: QuizQuestion["question_type"]) => {
    const newQuestion: QuizQuestion = {
      id: uuidv4(),
      question_type: type,
      question_text: "",
      points: 1,
      order_index: questions.length,
      options:
        type === "multiple_choice"
          ? [
              { id: uuidv4(), text: "", is_correct: false },
              { id: uuidv4(), text: "", is_correct: false },
              { id: uuidv4(), text: "", is_correct: false },
              { id: uuidv4(), text: "", is_correct: false },
            ]
          : undefined,
      correct_answer: type === "true_false" ? "true" : undefined,
      explanation: "",
    };
    setQuestions([...questions, newQuestion]);
  };

  const duplicateQuestion = (index: number) => {
    const original = questions[index];
    const duplicate: QuizQuestion = {
      ...original,
      id: uuidv4(),
      order_index: questions.length,
      options: original.options?.map((opt) => ({ ...opt, id: uuidv4() })),
    };
    setQuestions([...questions, duplicate]);
    toast({ title: "Question duplicated" });
  };

  const updateQuestion = (index: number, updates: Partial<QuizQuestion>) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], ...updates };
    setQuestions(updated);
  };

  const deleteQuestion = (index: number) => {
    const updated = questions
      .filter((_, i) => i !== index)
      .map((q, i) => ({
        ...q,
        order_index: i,
      }));
    setQuestions(updated);
    setDeleteDialogOpen(false);
    setQuestionToDelete(null);
  };

  const moveQuestion = (index: number, direction: "up" | "down") => {
    const updated = [...questions];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= updated.length) return;
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    const reindexed = updated.map((q, i) => ({
      ...q,
      order_index: i,
    }));
    setQuestions(reindexed);
  };

  const addOption = (questionIndex: number) => {
    const updated = [...questions];
    const question = updated[questionIndex];
    if (!question?.options) return;
    const newQuestion: QuizQuestion = {
      ...question,
      options: [...question.options, { id: uuidv4(), text: "", is_correct: false }],
    };
    updated[questionIndex] = newQuestion;
    setQuestions(updated);
  };

  const updateOption = (
    questionIndex: number,
    optionId: string,
    updates: Partial<{ text: string; is_correct: boolean }>
  ) => {
    const updated = [...questions];
    const question = updated[questionIndex];
    if (!question?.options) return;
    const newQuestion: QuizQuestion = {
      ...question,
      options: question.options.map((opt) =>
        opt.id === optionId ? { ...opt, ...updates } : opt
      ),
    };
    updated[questionIndex] = newQuestion;
    setQuestions(updated);
  };

  const deleteOption = (questionIndex: number, optionId: string) => {
    const updated = [...questions];
    const question = updated[questionIndex];
    if (!question?.options || question.options.length <= 2) return;
    const newQuestion: QuizQuestion = {
      ...question,
      options: question.options.filter((opt) => opt.id !== optionId),
    };
    updated[questionIndex] = newQuestion;
    setQuestions(updated);
  };

  const validateQuiz = (): string | null => {
    if (!title.trim()) return "Quiz title is required";
    if (targetType === "classroom" && !classroomId) return "Please select a classroom";
    if (targetType === "1v1" && !oneToOneRoomId) return "Please select a 1v1 room";
    if (questions.length === 0) return "Add at least one question";
    if (availableFrom && availableUntil) {
      const fromDate = new Date(availableFrom);
      const untilDate = new Date(availableUntil);
      if (untilDate <= fromDate) return "Available Until must be after Available From";
    }
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text.trim()) return `Question ${i + 1}: text is required`;
      if (q.question_type === "multiple_choice") {
        if (!q.options || q.options.length < 2) return `Question ${i + 1}: needs at least 2 options`;
        if (!q.options.some((opt) => opt.is_correct)) return `Question ${i + 1}: mark one correct answer`;
        if (q.options.some((opt) => !opt.text.trim())) return `Question ${i + 1}: has empty options`;
      }
      if (q.question_type === "short_answer" && !q.correct_answer?.trim()) {
        return `Question ${i + 1}: needs a sample correct answer`;
      }
    }
    return null;
  };

  const handleSave = async (publish: boolean = false) => {
    const error = validateQuiz();
    if (error) {
      toast({ title: "Cannot save", description: error, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const quizData: Partial<Quiz> = {
        title,
        description: description || undefined,
        instructions: instructions || undefined,
        classroom_id: targetType === "classroom" ? classroomId || null : null,
        one_to_one_room_id: targetType === "1v1" ? oneToOneRoomId || null : null,
        teacher_id: user?.id,
        time_limit_minutes: timeLimitMinutes ?? undefined,
        available_from: availableFrom ? new Date(availableFrom).toISOString() : undefined,
        available_until: availableUntil ? new Date(availableUntil).toISOString() : undefined,
        passing_score: passingScore ?? undefined,
        max_attempts: maxAttempts ?? undefined,
        randomize_questions: randomizeQuestions,
        show_correct_answers: hasShortAnswer ? false : showCorrectAnswers,
        show_results_immediately: hasShortAnswer ? false : showResultsImmediately,
        status: publish ? "active" : "draft",
        published_at: publish ? new Date().toISOString() : undefined,
      };
      let success = false;
      if (quizId) {
        success = await updateQuiz(quizId as string, quizData, questions);
      } else {
        const created = await createQuiz(quizData, questions);
        success = !!created;
      }
      if (success) router.push("/dashboard/teacher/quizzes");
    } catch (error: unknown) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <TooltipProvider delayDuration={300}>
        <div className="mx-auto max-w-4xl space-y-6 pb-6">
          {/* ── Header ─────────────────────────────────────────── */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {quizId ? "Edit Quiz" : "Create Quiz"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Build engaging assessments with AI or add questions manually
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/dashboard/teacher/quizzes")}
              className="self-start text-muted-foreground"
            >
              <X className="mr-1.5 h-4 w-4" />
              Cancel
            </Button>
          </div>

          {/* ── Quiz Basics ────────────────────────────────────── */}
          <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary/5 via-background to-background shadow-sm">
            <div className="p-6 sm:p-8">
              <div className="mb-6 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <h2 className="text-lg font-semibold">Quiz details</h2>
              </div>
              <div className=" flex flex-col gap-5 ">
                <div className="flex gap-2">
                <div className="space-y-2 flex-1 sm:col-span-2 sm:max-w-xl">
                  <Label htmlFor="title">
                    Quiz title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Chapter 5 — Ecosystems"
                    className="h-11 text-base"
                  />
                </div>
                <div className="space-y-2 flex-1">
                  <Label>Assign to <span className="text-destructive">*</span></Label>
                  <div className="flex gap-4 mb-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="quizTarget"
                        checked={targetType === "classroom"}
                        onChange={() => setTargetType("classroom")}
                        className="rounded border-input"
                      />
                      <span>Classroom</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="quizTarget"
                        checked={targetType === "1v1"}
                        onChange={() => setTargetType("1v1")}
                        className="rounded border-input"
                      />
                      <span>1v1 Room</span>
                    </label>
                  </div>
                  {targetType === "classroom" ? (
                    <Select value={classroomId} onValueChange={setClassroomId}>
                      <SelectTrigger id="classroom" className="h-11">
                        <SelectValue placeholder="Select classroom" />
                      </SelectTrigger>
                      <SelectContent>
                        {(classrooms || []).map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select value={oneToOneRoomId} onValueChange={setOneToOneRoomId}>
                      <SelectTrigger id="oneToOneRoom" className="h-11">
                        <SelectValue placeholder="Select 1v1 room" />
                      </SelectTrigger>
                      <SelectContent>
                        {(oneToOneRooms || []).map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name || `${r.studentProfile?.display_name ?? "Student"} (1v1)`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief overview for students"
                    rows={2}
                    className="resize-none"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="instructions">Instructions</Label>
                  <Textarea
                    id="instructions"
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="What should students know before starting?"
                    rows={2}
                    className="resize-none"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* ── Questions Section ──────────────────────────────── */}
          <Card className="overflow-hidden shadow-sm">
            {/* Questions header */}
            <div className="border-b bg-muted/30 px-6 py-4 sm:px-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">Questions</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {questions.length} question{questions.length !== 1 ? "s" : ""}
                      </span>
                      {questions.length > 0 && (
                        <>
                          <span className="text-muted-foreground/40">·</span>
                          <span className="text-sm font-medium text-muted-foreground">
                            {totalPoints} pt{totalPoints !== 1 ? "s" : ""} total
                          </span>
                          {Object.entries(questionTypeCounts).map(([type, count]) => {
                            const config = QUESTION_TYPE_CONFIG[type as QuizQuestion["question_type"]];
                            return (
                              <Badge key={type} variant="outline" className={cn("gap-1 text-xs", config?.color)}>
                                {config?.icon}
                                {count} {config?.shortLabel}
                              </Badge>
                            );
                          })}
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => setAiDialogOpen(true)}
                    disabled={aiLoading}
                    size="sm"
                    className="gap-2 bg-gradient-to-r from-primary to-primary/80"
                  >
                    <Sparkles className="h-4 w-4" />
                    Generate with AI
                  </Button>
                </div>
              </div>
            </div>

            {/* Questions body */}
            <div className="p-4 sm:p-6">
              {questions.length === 0 ? (
                /* ── Empty state ─────────────────────────────── */
                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-muted-foreground/20 bg-muted/10 px-6 py-16 text-center">
                  <div className="mb-4 rounded-full bg-primary/10 p-5">
                    <HelpCircle className="h-10 w-10 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold">No questions yet</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                    Get started quickly by generating questions with AI, or add
                    them manually using the buttons below.
                  </p>
                  <div className="mt-8 flex flex-col items-center gap-4">
                    <Button
                      onClick={() => setAiDialogOpen(true)}
                      disabled={aiLoading}
                      size="lg"
                      className="gap-2 bg-gradient-to-r from-primary to-primary/80"
                    >
                      <Sparkles className="h-5 w-5" />
                      Generate with AI
                    </Button>
                    <div className="flex items-center gap-3">
                      <Separator className="w-12" />
                      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        or add manually
                      </span>
                      <Separator className="w-12" />
                    </div>
                    <div className="flex gap-3">
                      {QUESTION_TYPES.map((type) => {
                        const config = QUESTION_TYPE_CONFIG[type.value];
                        return (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => addQuestion(type.value)}
                            className={cn(
                              "group flex flex-col items-center gap-2 rounded-xl border-2 border-border px-5 py-4 text-sm font-medium transition-all hover:shadow-md",
                              "hover:border-primary/50 hover:bg-muted/50"
                            )}
                          >
                            <div className={cn("rounded-lg p-2", config.bgColor, config.color)}>
                              {type.icon}
                            </div>
                            <span className="text-xs">{type.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                /* ── Question list ───────────────────────────── */
                <div className="space-y-3">
                  {questions.map((question, index) => {
                    const config = QUESTION_TYPE_CONFIG[question.question_type];
                    const hasCorrectAnswer =
                      question.question_type === "multiple_choice"
                        ? question.options?.some((opt) => opt.is_correct)
                        : question.question_type === "true_false"
                          ? !!question.correct_answer
                          : !!question.correct_answer?.trim();

                    return (
                      <Card
                        key={question.id}
                        className={cn(
                          "overflow-hidden border-l-4 transition-all hover:shadow-md",
                          config.borderColor
                        )}
                      >
                        <Collapsible defaultOpen={questions.length <= 5}>
                          {/* ── Collapsed header ──────────── */}
                          <CollapsibleTrigger asChild>
                            <button
                              type="button"
                              className="group flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/40 sm:px-5"
                            >
                              <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40" />

                              {/* Question number */}
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                                {index + 1}
                              </span>

                              {/* Type badge */}
                              <Badge
                                variant="outline"
                                className={cn("shrink-0 gap-1 text-xs", config.color)}
                              >
                                {config.icon}
                                <span className="hidden sm:inline">{config.label}</span>
                                <span className="sm:hidden">{config.shortLabel}</span>
                              </Badge>

                              {/* Question preview */}
                              <span className="min-w-0 flex-1 truncate text-sm">
                                {question.question_text || (
                                  <span className="italic text-muted-foreground">
                                    Untitled question
                                  </span>
                                )}
                              </span>

                              {/* Points pill */}
                              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                {question.points} pt{question.points !== 1 ? "s" : ""}
                              </span>

                              {/* Correct answer indicator */}
                              {hasCorrectAnswer ? (
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                              ) : (
                                <div className="h-4 w-4 shrink-0 rounded-full border-2 border-dashed border-orange-300" />
                              )}

                              <ChevronDown className="ml-1 h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-data-[state=open]:rotate-180" />
                            </button>
                          </CollapsibleTrigger>

                          {/* ── Expanded content ──────────── */}
                          <CollapsibleContent>
                            <div className="space-y-5 border-t bg-muted/5 px-4 py-5 sm:px-5">
                              {/* Question text */}
                              <div className="space-y-2">
                                <Label className="text-sm font-medium">
                                  Question text <span className="text-destructive">*</span>
                                </Label>
                                <Textarea
                                  value={question.question_text}
                                  onChange={(e) =>
                                    updateQuestion(index, { question_text: e.target.value })
                                  }
                                  placeholder="Enter your question here..."
                                  rows={2}
                                  className="resize-none text-base"
                                />
                              </div>

                              {/* Points */}
                              <div className="flex items-end gap-4">
                                <div className="w-28 space-y-2">
                                  <Label className="text-sm font-medium">Points</Label>
                                  <Input
                                    type="number"
                                    value={question.points}
                                    onChange={(e) =>
                                      updateQuestion(index, {
                                        points: parseFloat(e.target.value) || 1,
                                      })
                                    }
                                    min={0}
                                    step={0.5}
                                    className="h-10"
                                  />
                                </div>
                              </div>

                              {/* ── Multiple choice options ── */}
                              {question.question_type === "multiple_choice" && question.options && (
                                <div className="space-y-3">
                                  <Label className="text-sm font-medium">
                                    Answer options <span className="text-destructive">*</span>
                                  </Label>
                                  <div className="space-y-2">
                                    {question.options.map((option, optIdx) => (
                                      <div
                                        key={option.id}
                                        className={cn(
                                          "flex items-center gap-2 rounded-xl border p-2 transition-all",
                                          option.is_correct
                                            ? "border-emerald-300 bg-emerald-50/50 dark:border-emerald-700 dark:bg-emerald-950/30"
                                            : "border-border bg-background hover:border-muted-foreground/30"
                                        )}
                                      >
                                        {/* Letter label */}
                                        <div
                                          className={cn(
                                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold transition-colors",
                                            option.is_correct
                                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                                              : "bg-muted text-muted-foreground"
                                          )}
                                        >
                                          {OPTION_LETTERS[optIdx] || optIdx + 1}
                                        </div>

                                        {/* Option text input */}
                                        <Input
                                          value={option.text}
                                          onChange={(e) =>
                                            updateOption(index, option.id, { text: e.target.value })
                                          }
                                          placeholder={`Option ${OPTION_LETTERS[optIdx]}`}
                                          className="flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
                                        />

                                        {/* Correct toggle */}
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                updateOption(index, option.id, {
                                                  is_correct: !option.is_correct,
                                                })
                                              }
                                              className={cn(
                                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all",
                                                option.is_correct
                                                  ? "bg-emerald-500 text-white shadow-sm"
                                                  : "bg-muted text-muted-foreground hover:bg-muted-foreground/20"
                                              )}
                                            >
                                              <Check className="h-4 w-4" />
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            {option.is_correct ? "Marked correct" : "Mark as correct"}
                                          </TooltipContent>
                                        </Tooltip>

                                        {/* Delete option */}
                                        {question.options!.length > 2 && (
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                                                onClick={() => deleteOption(index, option.id)}
                                              >
                                                <X className="h-4 w-4" />
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>Remove option</TooltipContent>
                                          </Tooltip>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => addOption(index)}
                                    className="gap-2"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                    Add option
                                  </Button>
                                </div>
                              )}

                              {/* ── True/False selector ────── */}
                              {question.question_type === "true_false" && (
                                <div className="space-y-2">
                                  <Label className="text-sm font-medium">
                                    Correct answer <span className="text-destructive">*</span>
                                  </Label>
                                  <div className="flex gap-3">
                                    {[
                                      { value: "true", label: "True" },
                                      { value: "false", label: "False" },
                                    ].map((opt) => (
                                      <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() =>
                                          updateQuestion(index, { correct_answer: opt.value })
                                        }
                                        className={cn(
                                          "flex-1 rounded-xl border-2 py-3 text-sm font-medium transition-all",
                                          question.correct_answer === opt.value
                                            ? "border-emerald-400 bg-emerald-50 text-emerald-700 shadow-sm dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300"
                                            : "border-border hover:border-muted-foreground/40 hover:bg-muted/50"
                                        )}
                                      >
                                        {opt.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* ── Short answer ─────────────  */}
                              {question.question_type === "short_answer" && (
                                <div className="space-y-2">
                                  <Label className="text-sm font-medium">
                                    Sample correct answer <span className="text-destructive">*</span>
                                  </Label>
                                  <Input
                                    value={question.correct_answer || ""}
                                    onChange={(e) =>
                                      updateQuestion(index, { correct_answer: e.target.value })
                                    }
                                    placeholder="Reference answer for grading"
                                    className="h-10"
                                  />
                                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Lightbulb className="h-3 w-3" />
                                    Short answers are checked for similarity, not exact match
                                  </p>
                                </div>
                              )}

                              {/* ── Explanation ──────────────  */}
                              <div className="space-y-2">
                                <Label className="text-sm font-medium">Explanation</Label>
                                <Textarea
                                  value={question.explanation || ""}
                                  onChange={(e) =>
                                    updateQuestion(index, { explanation: e.target.value })
                                  }
                                  placeholder="Shown to students after submission to help them learn"
                                  rows={2}
                                  className="resize-none"
                                />
                              </div>

                              <Separator />

                              {/* ── Question actions ─────────  */}
                              <div className="flex items-center justify-between">
                                <div className="flex gap-1">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => moveQuestion(index, "up")}
                                        disabled={index === 0}
                                      >
                                        <ArrowUp className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Move up</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => moveQuestion(index, "down")}
                                        disabled={index === questions.length - 1}
                                      >
                                        <ArrowDown className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Move down</TooltipContent>
                                  </Tooltip>
                                  <Separator orientation="vertical" className="mx-1 h-6" />
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => duplicateQuestion(index)}
                                      >
                                        <Copy className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Duplicate</TooltipContent>
                                  </Tooltip>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => {
                                    setQuestionToDelete(index);
                                    setDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete
                                </Button>
                              </div>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </Card>
                    );
                  })}

                  {/* ── Add question bar ──────────────────── */}
                  <div className="flex items-center gap-3 pt-2">
                    <Separator className="flex-1" />
                    <div className="flex gap-1 rounded-xl border bg-background p-1 shadow-sm">
                      {QUESTION_TYPES.map((type) => {
                        const config = QUESTION_TYPE_CONFIG[type.value];
                        return (
                          <Tooltip key={type.value}>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className={cn("gap-1.5 transition-colors", config.color)}
                                onClick={() => addQuestion(type.value)}
                              >
                                {type.icon}
                                <span className="hidden sm:inline text-xs">{type.label}</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-medium">{type.label}</p>
                              <p className="text-xs text-muted-foreground">{type.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                    <Separator className="flex-1" />
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* ── Settings ───────────────────────────────────────── */}
          <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
            <Card className="overflow-hidden shadow-sm">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-muted/30 sm:px-8"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                      <Settings2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">Quiz settings</h2>
                      <p className="text-xs text-muted-foreground">
                        Time limits, attempts, availability, and display options
                      </p>
                    </div>
                  </div>
                  <ChevronRight
                    className={cn(
                      "h-5 w-5 text-muted-foreground transition-transform",
                      settingsOpen && "rotate-90"
                    )}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-6 border-t px-6 py-6 sm:px-8">
                  {/* Numeric settings */}
                  <div>
                    <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Target className="h-4 w-4" />
                      Scoring & Limits
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="timeLimit" className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          Time limit (min)
                        </Label>
                        <Input
                          id="timeLimit"
                          type="number"
                          value={timeLimitMinutes ?? ""}
                          onChange={(e) =>
                            setTimeLimitMinutes(e.target.value ? parseInt(e.target.value) : undefined)
                          }
                          placeholder="No limit"
                          min={1}
                          className="h-10"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="passingScore" className="flex items-center gap-1.5">
                          <Award className="h-3.5 w-3.5 text-muted-foreground" />
                          Passing score (%)
                        </Label>
                        <Input
                          id="passingScore"
                          type="number"
                          value={passingScore}
                          onChange={(e) => setPassingScore(parseInt(e.target.value) || 70)}
                          min={0}
                          max={100}
                          className="h-10"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="maxAttempts" className="flex items-center gap-1.5">
                          <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                          Max attempts
                        </Label>
                        <Input
                          id="maxAttempts"
                          type="number"
                          value={maxAttempts}
                          onChange={(e) => setMaxAttempts(parseInt(e.target.value) || 1)}
                          min={1}
                          className="h-10"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Availability */}
                  <div>
                    <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      Availability window
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="availableFrom">Available from</Label>
                        <Input
                          id="availableFrom"
                          type="datetime-local"
                          value={availableFrom}
                          onChange={(e) => setAvailableFrom(e.target.value)}
                          className="h-10"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="availableUntil">Available until</Label>
                        <Input
                          id="availableUntil"
                          type="datetime-local"
                          value={availableUntil}
                          onChange={(e) => setAvailableUntil(e.target.value)}
                          className="h-10"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Toggle settings */}
                  <div>
                    <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <BarChart3 className="h-4 w-4" />
                      Display & Behavior
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between rounded-xl border p-4 transition-colors hover:bg-muted/20">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                            <RefreshCw className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">Randomize questions</p>
                            <p className="text-xs text-muted-foreground">
                              Show questions in random order for each student
                            </p>
                          </div>
                        </div>
                        <Switch checked={randomizeQuestions} onCheckedChange={setRandomizeQuestions} />
                      </div>
                      <div className="flex items-center justify-between rounded-xl border p-4 transition-colors hover:bg-muted/20">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">Show correct answers</p>
                            <p className="text-xs text-muted-foreground">
                              {hasShortAnswer
                                ? "Disabled when quiz has short answer questions (requires manual grading)"
                                : "Let students see correct answers after submission"}
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={showCorrectAnswers}
                          onCheckedChange={setShowCorrectAnswers}
                          disabled={hasShortAnswer}
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-xl border p-4 transition-colors hover:bg-muted/20">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                            <Zap className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">Show results immediately</p>
                            <p className="text-xs text-muted-foreground">
                              {hasShortAnswer
                                ? "Disabled when quiz has short answer questions (requires manual grading)"
                                : "Display score right after submission"}
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={showResultsImmediately}
                          onCheckedChange={setShowResultsImmediately}
                          disabled={hasShortAnswer}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* ── Bottom action bar (in page flow) ───────────────── */}
          <div className="flex bg-white/80 items-center justify-between p-0 rounded-b-lg">
            <div className="hidden items-center gap-3 sm:flex">
              {questions.length > 0 && (
                <>
                  <Badge variant="outline" className="gap-1">
                    <ListTodo className="h-3 w-3" />
                    {questions.length} question{questions.length !== 1 ? "s" : ""}
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <Award className="h-3 w-3" />
                    {totalPoints} point{totalPoints !== 1 ? "s" : ""}
                  </Badge>
                </>
              )}
            </div>
            <div className="flex w-full gap-2 sm:w-auto sm:ml-auto">
              <Button
                variant="outline"
                onClick={() => handleSave(false)}
                disabled={saving || loadingQuiz}
                className="flex-1 gap-2 sm:flex-none"
              >
                <Save className="h-4 w-4" />
                Save Draft
              </Button>
              <Button
                onClick={() => handleSave(true)}
                disabled={saving || loadingQuiz}
                className="flex-1 gap-2 sm:flex-none"
              >
                <Check className="h-4 w-4" />
                {quizId ? "Update & Publish" : "Publish Quiz"}
              </Button>
            </div>
          </div>
        </div>
      </TooltipProvider>

      <AIGenerateQuestionsDialog
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
        onQuestionsGenerated={handleAIGenerateQuestions}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete question?</AlertDialogTitle>
            <AlertDialogDescription>
              This question and its options will be permanently removed. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => questionToDelete !== null && deleteQuestion(questionToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default TeacherQuizBuilder;
