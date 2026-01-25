import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
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
import { Clock, AlertCircle, Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuizzes, Quiz, QuizQuestion, QuizAttempt } from "@/hooks/useQuizzes";
import { Progress } from "@/components/ui/progress";

const StudentQuizTake = () => {
  const navigate = useNavigate();
  const { quizId, attemptId } = useParams();
  const { user } = useAuth();
  const {
    fetchQuizWithQuestions,
    startQuizAttempt,
    submitQuizAttempt,
    fetchQuizAttemptById,
    loading,
  } = useQuizzes();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (quizId) {
      loadQuiz();
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [quizId]);

  useEffect(() => {
    // Start timer if quiz has time limit and attempt is in progress
    if (quiz?.time_limit_minutes && attempt && attempt.status === 'in_progress') {
      const totalSeconds = quiz.time_limit_minutes * 60;
      
      // Calculate remaining time based on when attempt was started
      if (attempt.started_at) {
        const elapsedSeconds = Math.floor(
          (Date.now() - new Date(attempt.started_at).getTime()) / 1000
        );
        const remaining = Math.max(0, totalSeconds - elapsedSeconds);
        setTimeRemaining(remaining);
      } else {
        setTimeRemaining(totalSeconds);
      }

      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev === null || prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [quiz, attempt]);

  const loadQuiz = async () => {
    if (!quizId) return;
    const data = await fetchQuizWithQuestions(quizId);
    if (data) {
      setQuiz(data.quiz);
      // Randomize questions if enabled
      let loadedQuestions = data.questions;
      if (data.quiz.randomize_questions) {
        loadedQuestions = [...loadedQuestions].sort(() => Math.random() - 0.5);
      }
      setQuestions(loadedQuestions);

      // Start or resume attempt
      if (attemptId) {
        await resumeAttempt(attemptId);
      } else {
        await startAttempt();
      }
    }
  };

  const resumeAttempt = async (attemptId: string) => {
    const existingAttempt = await fetchQuizAttemptById(attemptId);
    if (existingAttempt) {
      // Check if attempt is still in progress
      if (existingAttempt.status !== 'in_progress') {
        // If already submitted, redirect to results
        navigate(`/dashboard/student/quizzes/${quizId}/results/${attemptId}`);
        return;
      }

      setAttempt(existingAttempt);
      
      // Restore answers from the attempt
      if (existingAttempt.answers && Array.isArray(existingAttempt.answers)) {
        const restoredAnswers: Record<string, string | string[]> = {};
        existingAttempt.answers.forEach((answer) => {
          restoredAnswers[answer.question_id] = answer.answer;
        });
        setAnswers(restoredAnswers);
      }
      
      // Calculate elapsed time if attempt was started
      if (existingAttempt.started_at) {
        const elapsedSeconds = Math.floor(
          (Date.now() - new Date(existingAttempt.started_at).getTime()) / 1000
        );
        startTimeRef.current = Date.now() - elapsedSeconds * 1000;
      } else {
        startTimeRef.current = Date.now();
      }
    } else {
      // If attempt not found, start a new one
      await startAttempt();
    }
  };

  const startAttempt = async () => {
    if (!quizId || !user?.id) return;
    const newAttempt = await startQuizAttempt(quizId, user.id);
    if (newAttempt) {
      setAttempt(newAttempt);
      startTimeRef.current = Date.now();
    } else {
      navigate("/dashboard/student/quizzes");
    }
  };

  const handleAutoSubmit = async () => {
    if (attempt) {
      await handleSubmit(true);
    }
  };

  const handleAnswerChange = (questionId: string, answer: string | string[]) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: answer,
    }));
  };

  const isQuestionAnswered = (questionId: string) => {
    const answer = answers[questionId];
    if (Array.isArray(answer)) {
      return answer.length > 0;
    }
    return answer !== undefined && answer !== "";
  };

  const calculateScore = () => {
    const processedAnswers = questions.map((question) => {
      const studentAnswer = answers[question.id!];
      let isCorrect = false;
      let pointsEarned = 0;

      if (question.question_type === "multiple_choice") {
        const correctOptions = question.options?.filter((opt) => opt.is_correct);
        const correctIds = correctOptions?.map((opt) => opt.id) || [];
        
        if (Array.isArray(studentAnswer)) {
          isCorrect = correctIds.length === studentAnswer.length && 
                     correctIds.every((id) => studentAnswer.includes(id));
        } else {
          isCorrect = correctIds.includes(studentAnswer as string);
        }
        pointsEarned = isCorrect ? question.points : 0;
      } else if (question.question_type === "true_false") {
        isCorrect = studentAnswer === question.correct_answer;
        pointsEarned = isCorrect ? question.points : 0;
      } else if (question.question_type === "short_answer") {
        // Short answers need manual grading
        isCorrect = false;
        pointsEarned = 0;
      }

      return {
        question_id: question.id!,
        answer: studentAnswer || "",
        is_correct: isCorrect,
        points_earned: pointsEarned,
        points_possible: question.points,
      };
    });

    return processedAnswers;
  };

  const handleSubmit = async (autoSubmit: boolean = false) => {
    if (!attempt) return;

    if (!autoSubmit && !confirm("Are you sure you want to submit? You cannot change your answers after submission.")) {
      return;
    }

    setSubmitting(true);

    const timeSpent = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const processedAnswers = calculateScore();

    const success = await submitQuizAttempt(attempt.id, processedAnswers, timeSpent);

    setSubmitting(false);

    if (success) {
      navigate(`/dashboard/student/quizzes/${quizId}/results/${attempt.id}`);
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  // Safety check for current question
  if (loading || !quiz || !attempt || questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading quiz...</p>
      </div>
    );
  }

  // Check if attempt is still in progress
  if (attempt.status !== 'in_progress') {
    // Redirect to results if already submitted
    if (quizId && attempt.id) {
      navigate(`/dashboard/student/quizzes/${quizId}/results/${attempt.id}`);
    }
    return null;
  }

  // Ensure currentQuestionIndex is valid
  const validIndex = Math.min(Math.max(0, currentQuestionIndex), questions.length - 1);
  const currentQuestion = questions[validIndex];
  
  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading quiz...</p>
      </div>
    );
  }

  const progress = ((validIndex + 1) / questions.length) * 100;
  const answeredCount = questions.filter((q) => isQuestionAnswered(q.id!)).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Fixed Header */}
      <div className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">{quiz.title}</h1>
              <p className="text-sm text-muted-foreground">
                Question {validIndex + 1} of {questions.length}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {timeRemaining !== null && (
                <div
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                    timeRemaining < 60
                      ? "bg-destructive/10 text-destructive"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  <Clock className="h-5 w-5" />
                  <span className="font-mono text-lg font-bold">
                    {formatTime(timeRemaining)}
                  </span>
                </div>
              )}
              <Button
                onClick={() => setSubmitDialogOpen(true)}
                disabled={submitting}
              >
                Submit Quiz
              </Button>
            </div>
          </div>
          <Progress value={progress} className="mt-3" />
        </div>
      </div>

      {/* Main Content */}
      <div className="container max-w-4xl mx-auto px-4 py-8">
        {quiz.instructions && currentQuestionIndex === 0 && (
          <Card className="p-4 mb-6 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                  Instructions
                </h3>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  {quiz.instructions}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Question Card */}
        <Card className="p-8">
          <div className="mb-6">
            <div className="flex items-start justify-between mb-3">
              <h2 className="text-2xl font-semibold">
                Question {validIndex + 1}
              </h2>
              <Badge variant="outline">{currentQuestion.points} points</Badge>
            </div>
            <p className="text-lg">{currentQuestion.question_text}</p>
          </div>

          {/* Multiple Choice */}
          {currentQuestion.question_type === "multiple_choice" && (
            <RadioGroup
              value={answers[currentQuestion.id!] as string}
              onValueChange={(value) => handleAnswerChange(currentQuestion.id!, value)}
            >
              <div className="space-y-3">
                {currentQuestion.options?.map((option) => (
                  <div
                    key={option.id}
                    className="flex items-center space-x-3 p-4 rounded-lg border hover:bg-accent transition-colors cursor-pointer"
                  >
                    <RadioGroupItem value={option.id} id={option.id} />
                    <Label htmlFor={option.id} className="flex-1 cursor-pointer">
                      {option.text}
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          )}

          {/* True/False */}
          {currentQuestion.question_type === "true_false" && (
            <RadioGroup
              value={answers[currentQuestion.id!] as string}
              onValueChange={(value) => handleAnswerChange(currentQuestion.id!, value)}
            >
              <div className="space-y-3">
                <div className="flex items-center space-x-3 p-4 rounded-lg border hover:bg-accent transition-colors cursor-pointer">
                  <RadioGroupItem value="true" id="true" />
                  <Label htmlFor="true" className="flex-1 cursor-pointer">
                    True
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-4 rounded-lg border hover:bg-accent transition-colors cursor-pointer">
                  <RadioGroupItem value="false" id="false" />
                  <Label htmlFor="false" className="flex-1 cursor-pointer">
                    False
                  </Label>
                </div>
              </div>
            </RadioGroup>
          )}

          {/* Short Answer */}
          {currentQuestion.question_type === "short_answer" && (
            <div>
              <Label htmlFor="short-answer" className="mb-2 block">
                Your Answer
              </Label>
              <Textarea
                id="short-answer"
                value={(answers[currentQuestion.id!] as string) || ""}
                onChange={(e) => handleAnswerChange(currentQuestion.id!, e.target.value)}
                placeholder="Type your answer here..."
                rows={6}
                className="resize-none"
              />
            </div>
          )}
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="outline"
            onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentQuestionIndex === 0}
          >
            Previous
          </Button>

          <div className="text-sm text-muted-foreground">
            {answeredCount} of {questions.length} answered
          </div>

          <Button
            onClick={() =>
              setCurrentQuestionIndex((prev) =>
                Math.min(questions.length - 1, prev + 1)
              )
            }
            disabled={currentQuestionIndex === questions.length - 1}
          >
            Next
          </Button>
        </div>

        {/* Question Navigator */}
        <Card className="p-6 mt-6">
          <h3 className="font-semibold mb-4">Question Navigator</h3>
          <div className="grid grid-cols-8 md:grid-cols-12 gap-2">
            {questions.map((question, index) => (
              <Button
                key={question.id}
                variant={
                  index === currentQuestionIndex
                    ? "default"
                    : isQuestionAnswered(question.id!)
                    ? "outline"
                    : "ghost"
                }
                size="sm"
                onClick={() => {
              if (index >= 0 && index < questions.length) {
                setCurrentQuestionIndex(index);
              }
            }}
                className="relative"
              >
                {index + 1}
                {isQuestionAnswered(question.id!) && (
                  <Check className="h-3 w-3 absolute -top-1 -right-1 text-green-500" />
                )}
              </Button>
            ))}
          </div>
        </Card>
      </div>

      {/* Submit Confirmation Dialog */}
      <AlertDialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Quiz?</AlertDialogTitle>
            <AlertDialogDescription>
              You have answered {answeredCount} out of {questions.length} questions.
              {answeredCount < questions.length && (
                <span className="block mt-2 text-destructive">
                  Warning: You have not answered all questions. Unanswered questions will
                  receive 0 points.
                </span>
              )}
              <span className="block mt-2">
                Are you sure you want to submit? You cannot change your answers after
                submission.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Review Answers</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setSubmitDialogOpen(false);
                handleSubmit(false);
              }}
            >
              Submit Quiz
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StudentQuizTake;
