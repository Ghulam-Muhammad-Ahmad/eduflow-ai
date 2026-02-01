import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { Plus, Trash2, GripVertical, Save, X, Check, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuizzes, Quiz, QuizQuestion } from "@/hooks/useQuizzes";
import { useClassrooms } from "@/hooks/useClassrooms";
import { useAIStudio } from "@/hooks/useAIStudio";
import { v4 as uuidv4 } from "uuid";

const TeacherQuizBuilder = () => {
  const router = useRouter();
  const { quizId } = router.query;
  const { user } = useAuth();
  const {
    fetchQuizWithQuestions,
    createQuiz,
    updateQuiz,
    loading: quizLoading,
  } = useQuizzes();
  const { classrooms, loading: classroomsLoading } = useClassrooms();
  const { createQuizQuestions, loading: aiLoading } = useAIStudio();

  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<number | null>(null);

  // Quiz Details
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [classroomId, setClassroomId] = useState("");
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number | undefined>();
  const [availableFrom, setAvailableFrom] = useState("");
  const [availableUntil, setAvailableUntil] = useState("");
  const [passingScore, setPassingScore] = useState<number>(70);
  const [maxAttempts, setMaxAttempts] = useState<number>(1);
  const [randomizeQuestions, setRandomizeQuestions] = useState(false);
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(true);
  const [showResultsImmediately, setShowResultsImmediately] = useState(true);

  // Questions
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);

  useEffect(() => {
    if (quizId) {
      loadQuiz();
    }
  }, [quizId]);

  const loadQuiz = async () => {
    if (!quizId) return;
    const data = await fetchQuizWithQuestions(quizId);
    if (data) {
      const { quiz, questions: loadedQuestions } = data;
      setTitle(quiz.title);
      setDescription(quiz.description || "");
      setInstructions(quiz.instructions || "");
      setClassroomId(quiz.classroom_id);
      setTimeLimitMinutes(quiz.time_limit_minutes || undefined);
      setAvailableFrom(quiz.available_from ? quiz.available_from.slice(0, 16) : "");
      setAvailableUntil(quiz.available_until ? quiz.available_until.slice(0, 16) : "");
      setPassingScore(quiz.passing_score || 70);
      setMaxAttempts(quiz.max_attempts || 1);
      setRandomizeQuestions(quiz.randomize_questions);
      setShowCorrectAnswers(quiz.show_correct_answers);
      setShowResultsImmediately(quiz.show_results_immediately);
      setQuestions(loadedQuestions);
    }
  };

  const handleAIGenerateQuestions = async () => {
    // Simple prompt for now - can be enhanced with document selection
    const sourceMaterial = prompt("Enter the source material or topic to generate questions from:");
    if (!sourceMaterial) return;

    const numQuestions = parseInt(prompt("How many questions? (1-20)", "5") || "5");
    const questionType = prompt("Question type? (multiple_choice/true_false/short_answer)", "multiple_choice") as "multiple_choice" | "true_false" | "short_answer";

    const result = await createQuizQuestions(sourceMaterial, numQuestions, questionType);
    
    if (result?.success) {
      // Try to parse and add questions
      try {
        const jsonMatch = result.content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsedQuestions = JSON.parse(jsonMatch[0]);
          parsedQuestions.forEach((q: any) => {
            const newQuestion: QuizQuestion = {
              question_type: questionType,
              question_text: q.question_text || q.question,
              points: 1,
              order_index: questions.length,
              options: questionType === "multiple_choice" && q.options 
                ? q.options.map((opt: any) => ({
                    id: uuidv4(),
                    text: opt.text || opt,
                    is_correct: opt.is_correct || false,
                  }))
                : undefined,
              correct_answer: questionType !== "multiple_choice" ? (q.correct_answer || q.answer) : undefined,
              explanation: q.explanation || "",
            };
            setQuestions([...questions, newQuestion]);
          });
          alert(`Added ${parsedQuestions.length} questions from AI`);
        } else {
          // Fallback: add as single question
          const newQuestion: QuizQuestion = {
            question_type: questionType,
            question_text: result.content.substring(0, 200),
            points: 1,
            order_index: questions.length,
          };
          setQuestions([...questions, newQuestion]);
        }
      } catch (error) {
        console.error("Error parsing AI questions:", error);
        alert("Generated questions - please review and add manually");
      }
    }
  };

  const addQuestion = (type: QuizQuestion['question_type']) => {
    const newQuestion: QuizQuestion = {
      question_type: type,
      question_text: "",
      points: 1,
      order_index: questions.length,
      options:
        type === "multiple_choice"
          ? [
              { id: uuidv4(), text: "", is_correct: false },
              { id: uuidv4(), text: "", is_correct: false },
            ]
          : undefined,
      correct_answer: type === "true_false" ? "true" : undefined,
      explanation: "",
    };
    setQuestions([...questions, newQuestion]);
  };

  const updateQuestion = (index: number, updates: Partial<QuizQuestion>) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], ...updates };
    setQuestions(updated);
  };

  const deleteQuestion = (index: number) => {
    const updated = questions.filter((_, i) => i !== index);
    // Reorder
    updated.forEach((q, i) => {
      q.order_index = i;
    });
    setQuestions(updated);
    setDeleteDialogOpen(false);
    setQuestionToDelete(null);
  };

  const moveQuestion = (index: number, direction: "up" | "down") => {
    const updated = [...questions];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= updated.length) return;

    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    // Update order indices
    updated.forEach((q, i) => {
      q.order_index = i;
    });
    setQuestions(updated);
  };

  const addOption = (questionIndex: number) => {
    const updated = [...questions];
    const question = updated[questionIndex];
    if (question.options) {
      question.options = [
        ...question.options,
        { id: uuidv4(), text: "", is_correct: false },
      ];
      setQuestions(updated);
    }
  };

  const updateOption = (
    questionIndex: number,
    optionId: string,
    updates: Partial<{ text: string; is_correct: boolean }>
  ) => {
    const updated = [...questions];
    const question = updated[questionIndex];
    if (question.options) {
      question.options = question.options.map((opt) =>
        opt.id === optionId ? { ...opt, ...updates } : opt
      );
      setQuestions(updated);
    }
  };

  const deleteOption = (questionIndex: number, optionId: string) => {
    const updated = [...questions];
    const question = updated[questionIndex];
    if (question.options && question.options.length > 2) {
      question.options = question.options.filter((opt) => opt.id !== optionId);
      setQuestions(updated);
    }
  };

  const validateQuiz = (): string | null => {
    if (!title.trim()) return "Quiz title is required";
    if (!classroomId) return "Please select a classroom";
    if (questions.length === 0) return "Add at least one question";

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text.trim()) return `Question ${i + 1} text is required`;

      if (q.question_type === "multiple_choice") {
        if (!q.options || q.options.length < 2)
          return `Question ${i + 1} needs at least 2 options`;
        if (!q.options.some((opt) => opt.is_correct))
          return `Question ${i + 1} needs at least one correct answer`;
        if (q.options.some((opt) => !opt.text.trim()))
          return `Question ${i + 1} has empty options`;
      }

      if (q.question_type === "short_answer" && !q.correct_answer?.trim()) {
        return `Question ${i + 1} needs a sample correct answer`;
      }
    }

    return null;
  };

  const handleSave = async (publish: boolean = false) => {
    const error = validateQuiz();
    if (error) {
      alert(error);
      return;
    }

    setSaving(true);

    const quizData: Partial<Quiz> = {
      title,
      description: description || null,
      instructions: instructions || null,
      classroom_id: classroomId,
      teacher_id: user?.id,
      time_limit_minutes: timeLimitMinutes || null,
      available_from: availableFrom ? new Date(availableFrom).toISOString() : null,
      available_until: availableUntil ? new Date(availableUntil).toISOString() : null,
      passing_score: passingScore,
      max_attempts: maxAttempts,
      randomize_questions: randomizeQuestions,
      show_correct_answers: showCorrectAnswers,
      show_results_immediately: showResultsImmediately,
      status: publish ? "active" : "draft",
      published_at: publish ? new Date().toISOString() : null,
    };

    let success = false;
    if (quizId) {
      success = await updateQuiz(quizId, quizData, questions);
    } else {
      const created = await createQuiz(quizData, questions);
      success = !!created;
    }

    setSaving(false);

    if (success) {
      router.push("/dashboard/teacher/quizzes");
    }
  };

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {quizId ? "Edit Quiz" : "Create Quiz"}
            </h1>
            <p className="text-muted-foreground mt-1">
              Build your quiz with multiple question types
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard/teacher/quizzes")}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSave(false)}
              disabled={saving}
            >
              <Save className="h-4 w-4 mr-2" />
              Save as Draft
            </Button>
            <Button onClick={() => handleSave(true)} disabled={saving}>
              <Check className="h-4 w-4 mr-2" />
              {quizId ? "Update & Publish" : "Create & Publish"}
            </Button>
          </div>
        </div>

        {/* Quiz Details */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Quiz Details</h2>
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="title">Quiz Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Chapter 5 Quiz"
                />
              </div>
              <div>
                <Label htmlFor="classroom">Classroom *</Label>
                <Select value={classroomId} onValueChange={setClassroomId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select classroom" />
                  </SelectTrigger>
                  <SelectContent>
                    {classrooms.map((classroom) => (
                      <SelectItem key={classroom.id} value={classroom.id}>
                        {classroom.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the quiz"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="instructions">Instructions</Label>
              <Textarea
                id="instructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Instructions for students taking this quiz"
                rows={3}
              />
            </div>

            <div className="grid md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="timeLimit">Time Limit (minutes)</Label>
                <Input
                  id="timeLimit"
                  type="number"
                  value={timeLimitMinutes || ""}
                  onChange={(e) =>
                    setTimeLimitMinutes(e.target.value ? parseInt(e.target.value) : undefined)
                  }
                  placeholder="No limit"
                  min="1"
                />
              </div>
              <div>
                <Label htmlFor="passingScore">Passing Score (%)</Label>
                <Input
                  id="passingScore"
                  type="number"
                  value={passingScore}
                  onChange={(e) => setPassingScore(parseInt(e.target.value))}
                  min="0"
                  max="100"
                />
              </div>
              <div>
                <Label htmlFor="maxAttempts">Max Attempts</Label>
                <Input
                  id="maxAttempts"
                  type="number"
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(parseInt(e.target.value))}
                  min="1"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="availableFrom">Available From</Label>
                <Input
                  id="availableFrom"
                  type="datetime-local"
                  value={availableFrom}
                  onChange={(e) => setAvailableFrom(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="availableUntil">Available Until</Label>
                <Input
                  id="availableUntil"
                  type="datetime-local"
                  value={availableUntil}
                  onChange={(e) => setAvailableUntil(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Randomize Questions</Label>
                  <p className="text-sm text-muted-foreground">
                    Show questions in random order to each student
                  </p>
                </div>
                <Switch
                  checked={randomizeQuestions}
                  onCheckedChange={setRandomizeQuestions}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Show Correct Answers</Label>
                  <p className="text-sm text-muted-foreground">
                    Let students see correct answers after submission
                  </p>
                </div>
                <Switch
                  checked={showCorrectAnswers}
                  onCheckedChange={setShowCorrectAnswers}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Show Results Immediately</Label>
                  <p className="text-sm text-muted-foreground">
                    Display score immediately after submission
                  </p>
                </div>
                <Switch
                  checked={showResultsImmediately}
                  onCheckedChange={setShowResultsImmediately}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Questions */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Questions</h2>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => addQuestion("multiple_choice")}
              >
                <Plus className="h-4 w-4 mr-2" />
                Multiple Choice
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => addQuestion("true_false")}
              >
                <Plus className="h-4 w-4 mr-2" />
                True/False
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => addQuestion("short_answer")}
              >
                <Plus className="h-4 w-4 mr-2" />
                Short Answer
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAIGenerateQuestions}
                disabled={aiLoading}
              >
                {aiLoading ? (
                  <>
                    <Sparkles className="h-4 w-4 mr-2 animate-pulse" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    AI Generate
                  </>
                )}
              </Button>
            </div>
          </div>

          {questions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No questions yet. Add your first question to get started.</p>
            </div>
          ) : (
            <Accordion type="multiple" className="space-y-4">
              {questions.map((question, index) => (
                <AccordionItem
                  key={index}
                  value={`question-${index}`}
                  className="border rounded-lg px-4"
                >
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 w-full">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Question {index + 1}</span>
                      <span className="text-sm text-muted-foreground capitalize">
                        ({question.question_type.replace("_", " ")})
                      </span>
                      {question.question_text && (
                        <span className="text-sm text-muted-foreground truncate flex-1 text-left">
                          - {question.question_text}
                        </span>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div>
                      <Label>Question Text *</Label>
                      <Textarea
                        value={question.question_text}
                        onChange={(e) =>
                          updateQuestion(index, { question_text: e.target.value })
                        }
                        placeholder="Enter your question"
                        rows={2}
                      />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label>Points</Label>
                        <Input
                          type="number"
                          value={question.points}
                          onChange={(e) =>
                            updateQuestion(index, {
                              points: parseFloat(e.target.value) || 1,
                            })
                          }
                          min="0"
                          step="0.5"
                        />
                      </div>
                    </div>

                    {/* Multiple Choice Options */}
                    {question.question_type === "multiple_choice" && question.options && (
                      <div className="space-y-2">
                        <Label>Options *</Label>
                        {question.options.map((option) => (
                          <div key={option.id} className="flex gap-2 items-center">
                            <Input
                              value={option.text}
                              onChange={(e) =>
                                updateOption(index, option.id, { text: e.target.value })
                              }
                              placeholder="Option text"
                              className="flex-1"
                            />
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={option.is_correct}
                                onCheckedChange={(checked) =>
                                  updateOption(index, option.id, { is_correct: checked })
                                }
                              />
                              <Label className="text-sm">Correct</Label>
                            </div>
                            {question.options!.length > 2 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteOption(index, option.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addOption(index)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Option
                        </Button>
                      </div>
                    )}

                    {/* True/False */}
                    {question.question_type === "true_false" && (
                      <div>
                        <Label>Correct Answer *</Label>
                        <Select
                          value={question.correct_answer}
                          onValueChange={(value) =>
                            updateQuestion(index, { correct_answer: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">True</SelectItem>
                            <SelectItem value="false">False</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Short Answer */}
                    {question.question_type === "short_answer" && (
                      <div>
                        <Label>Sample Correct Answer *</Label>
                        <Input
                          value={question.correct_answer || ""}
                          onChange={(e) =>
                            updateQuestion(index, { correct_answer: e.target.value })
                          }
                          placeholder="Enter a sample correct answer for reference"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          This will need to be manually graded
                        </p>
                      </div>
                    )}

                    <div>
                      <Label>Explanation (optional)</Label>
                      <Textarea
                        value={question.explanation || ""}
                        onChange={(e) =>
                          updateQuestion(index, { explanation: e.target.value })
                        }
                        placeholder="Explain the correct answer (shown after submission)"
                        rows={2}
                      />
                    </div>

                    <div className="flex justify-between pt-2">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => moveQuestion(index, "up")}
                          disabled={index === 0}
                        >
                          Move Up
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => moveQuestion(index, "down")}
                          disabled={index === questions.length - 1}
                        >
                          Move Down
                        </Button>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setQuestionToDelete(index);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Question
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </Card>
      </div>

      {/* Delete Question Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Question</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this question? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => questionToDelete !== null && deleteQuestion(questionToDelete)}
              className="bg-destructive"
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
