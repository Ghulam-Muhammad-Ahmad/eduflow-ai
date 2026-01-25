import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, CheckCircle, XCircle, Clock, Target, TrendingUp } from "lucide-react";
import { useQuizzes, Quiz, QuizAttempt, QuizQuestion } from "@/hooks/useQuizzes";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

const StudentQuizResults = () => {
  const navigate = useNavigate();
  const { quizId, attemptId } = useParams();
  const { fetchQuizWithQuestions } = useQuizzes();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (quizId && attemptId) {
      loadData();
    }
  }, [quizId, attemptId]);

  const loadData = async () => {
    if (!quizId || !attemptId) return;

    try {
      setLoading(true);

      // Load quiz and questions
      const quizData = await fetchQuizWithQuestions(quizId);
      if (quizData) {
        setQuiz(quizData.quiz);
        setQuestions(quizData.questions);
      }

      // Load attempt
      const { data: attemptData, error } = await supabase
        .from("quiz_attempts")
        .select("*")
        .eq("id", attemptId)
        .single();

      if (error) throw error;
      setAttempt(attemptData as QuizAttempt);
    } catch (error) {
      console.error("Error loading quiz results:", error);
    } finally {
      setLoading(false);
    }
  };

  const getAnswerForQuestion = (questionId: string) => {
    return attempt?.answers.find((ans) => ans.question_id === questionId);
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const getScoreColor = (score: number, passingScore: number) => {
    if (score >= passingScore) return "text-green-600 dark:text-green-400";
    if (score >= passingScore * 0.7) return "text-blue-600 dark:text-blue-400";
    return "text-red-600 dark:text-red-400";
  };

  const getScoreBadge = (score: number, passingScore: number) => {
    if (score >= passingScore) {
      return <Badge variant="live" className="bg-green-500">Passed</Badge>;
    } else {
      return <Badge variant="destructive">Not Passed</Badge>;
    }
  };

  if (loading || !quiz || !attempt) {
    return (
      <DashboardLayout role="student">
        <div className="flex items-center justify-center h-64">
          <p>Loading results...</p>
        </div>
      </DashboardLayout>
    );
  }

  const score = attempt.score || 0;
  const passingScore = quiz.passing_score || 70;
  const totalQuestions = questions.length;
  const correctAnswers = attempt.answers.filter((ans) => ans.is_correct).length;

  return (
    <DashboardLayout role="student">
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard/student/quizzes")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">{quiz.title}</h1>
              <p className="text-muted-foreground mt-1">Quiz Results</p>
            </div>
          </div>
        </div>

        {/* Score Summary */}
        <Card className="p-8">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-primary/10 mb-4">
              <div className="text-center">
                <div className={`text-5xl font-bold ${getScoreColor(score, passingScore)}`}>
                  {score.toFixed(0)}%
                </div>
                <div className="text-sm text-muted-foreground mt-1">Your Score</div>
              </div>
            </div>

            <div className="flex justify-center">
              {getScoreBadge(score, passingScore)}
            </div>

            <p className="text-muted-foreground">
              You scored {attempt.points_earned?.toFixed(1)} out of{" "}
              {attempt.points_possible?.toFixed(1)} points
            </p>

            <div className="grid md:grid-cols-3 gap-4 mt-6">
              <div className="text-center p-4 bg-secondary/50 rounded-lg">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Target className="h-5 w-5 text-primary" />
                  <span className="font-semibold">Accuracy</span>
                </div>
                <p className="text-2xl font-bold">
                  {correctAnswers}/{totalQuestions}
                </p>
                <p className="text-xs text-muted-foreground">Correct Answers</p>
              </div>

              <div className="text-center p-4 bg-secondary/50 rounded-lg">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Clock className="h-5 w-5 text-primary" />
                  <span className="font-semibold">Time Taken</span>
                </div>
                <p className="text-2xl font-bold">
                  {attempt.time_spent_seconds
                    ? formatTime(attempt.time_spent_seconds)
                    : "N/A"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {quiz.time_limit_minutes ? `of ${quiz.time_limit_minutes}m` : "No limit"}
                </p>
              </div>

              <div className="text-center p-4 bg-secondary/50 rounded-lg">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <span className="font-semibold">Attempt</span>
                </div>
                <p className="text-2xl font-bold">#{attempt.attempt_number}</p>
                <p className="text-xs text-muted-foreground">
                  {quiz.max_attempts ? `of ${quiz.max_attempts}` : "Unlimited"}
                </p>
              </div>
            </div>

            {attempt.feedback && (
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  Teacher Feedback
                </h3>
                <p className="text-sm text-blue-800 dark:text-blue-200">{attempt.feedback}</p>
              </div>
            )}

            {quiz.show_correct_answers ? (
              <p className="text-sm text-muted-foreground">
                Scroll down to review your answers and see correct solutions
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Correct answers are hidden for this quiz
              </p>
            )}
          </div>
        </Card>

        {/* Question Review */}
        {quiz.show_correct_answers && (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Answer Review</h2>

            {questions.map((question, index) => {
              const studentAnswer = getAnswerForQuestion(question.id!);
              const isCorrect = studentAnswer?.is_correct || false;

              return (
                <Card
                  key={question.id}
                  className={`p-6 ${
                    isCorrect
                      ? "border-green-500 bg-green-50 dark:bg-green-950"
                      : "border-red-500 bg-red-50 dark:bg-red-950"
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-3 flex-1">
                      {isCorrect ? (
                        <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400 mt-1 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-6 w-6 text-red-600 dark:text-red-400 mt-1 flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-2">
                          Question {index + 1}
                        </h3>
                        <p className="text-foreground">{question.question_text}</p>
                      </div>
                    </div>
                    <Badge variant="outline">
                      {studentAnswer?.points_earned?.toFixed(1) || 0}/{question.points} pts
                    </Badge>
                  </div>

                  {/* Multiple Choice */}
                  {question.question_type === "multiple_choice" && (
                    <div className="space-y-2 ml-9">
                      {question.options?.map((option) => {
                        const isStudentAnswer = studentAnswer?.answer === option.id;
                        const isCorrectOption = option.is_correct;

                        return (
                          <div
                            key={option.id}
                            className={`p-3 rounded-lg border ${
                              isCorrectOption
                                ? "border-green-500 bg-green-100 dark:bg-green-900"
                                : isStudentAnswer
                                ? "border-red-500 bg-red-100 dark:bg-red-900"
                                : "border-secondary bg-secondary"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span>{option.text}</span>
                              {isCorrectOption && (
                                <Badge variant="live" className="bg-green-500">
                                  Correct Answer
                                </Badge>
                              )}
                              {isStudentAnswer && !isCorrectOption && (
                                <Badge variant="destructive">Your Answer</Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* True/False */}
                  {question.question_type === "true_false" && (
                    <div className="ml-9 space-y-2">
                      <div className="flex items-center justify-between">
                        <span>Your Answer:</span>
                        <Badge variant={isCorrect ? "live" : "destructive"}>
                          {studentAnswer?.answer as string}
                        </Badge>
                      </div>
                      {!isCorrect && (
                        <div className="flex items-center justify-between">
                          <span>Correct Answer:</span>
                          <Badge variant="live" className="bg-green-500">
                            {question.correct_answer}
                          </Badge>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Short Answer */}
                  {question.question_type === "short_answer" && (
                    <div className="ml-9 space-y-3">
                      <div>
                        <Label className="text-sm text-muted-foreground">Your Answer:</Label>
                        <div className="mt-1 p-3 bg-secondary rounded-lg">
                          <p className="text-sm">{studentAnswer?.answer as string}</p>
                        </div>
                      </div>
                      {question.correct_answer && (
                        <div>
                          <Label className="text-sm text-muted-foreground">
                            Sample Correct Answer:
                          </Label>
                          <div className="mt-1 p-3 bg-green-100 dark:bg-green-900 rounded-lg border border-green-500">
                            <p className="text-sm">{question.correct_answer}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {question.explanation && (
                    <div className="mt-4 ml-9 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <h4 className="font-semibold text-sm text-blue-900 dark:text-blue-100 mb-1">
                        Explanation:
                      </h4>
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        {question.explanation}
                      </p>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between items-center py-6">
          <Button
            variant="outline"
            onClick={() => navigate("/dashboard/student/quizzes")}
          >
            Back to Quizzes
          </Button>

          {quiz.max_attempts && attempt.attempt_number < quiz.max_attempts && (
            <Button onClick={() => navigate(`/dashboard/student/quizzes/${quizId}/take`)}>
              Retake Quiz
            </Button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentQuizResults;
