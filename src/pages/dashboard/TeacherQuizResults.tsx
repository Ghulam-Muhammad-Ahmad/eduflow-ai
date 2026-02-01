import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ArrowLeft, Download, Clock, Target, Users, TrendingUp, Check, X, Edit } from "lucide-react";
import { useQuizzes, Quiz, QuizAttempt, QuizQuestion } from "@/hooks/useQuizzes";
import { format } from "date-fns";

const TeacherQuizResults = () => {
  const router = useRouter();
  const { quizId } = router.query;
  const { fetchQuizWithQuestions, fetchQuizAttempts, gradeShortAnswers, loading } = useQuizzes();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [selectedAttempt, setSelectedAttempt] = useState<QuizAttempt | null>(null);
  const [gradingDialogOpen, setGradingDialogOpen] = useState(false);
  const [gradingAnswers, setGradingAnswers] = useState<Array<{ question_id: string; points_earned: number; is_correct: boolean }>>([]);

  useEffect(() => {
    if (quizId) {
      loadQuizData();
      loadAttempts();
    }
  }, [quizId]);

  const loadQuizData = async () => {
    if (!quizId) return;
    const data = await fetchQuizWithQuestions(quizId);
    if (data) {
      setQuiz(data.quiz);
      setQuestions(data.questions);
    }
  };

  const loadAttempts = async () => {
    if (!quizId) return;
    const data = await fetchQuizAttempts(quizId);
    setAttempts(data);
  };

  const calculateStats = () => {
    if (attempts.length === 0) {
      return {
        totalAttempts: 0,
        averageScore: 0,
        highestScore: 0,
        lowestScore: 0,
        passRate: 0,
        completedAttempts: 0,
      };
    }

    const completedAttempts = attempts.filter((a) => a.status === "graded");
    const scores = completedAttempts.map((a) => a.score || 0);

    return {
      totalAttempts: attempts.length,
      completedAttempts: completedAttempts.length,
      averageScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
      highestScore: scores.length > 0 ? Math.max(...scores) : 0,
      lowestScore: scores.length > 0 ? Math.min(...scores) : 0,
      passRate:
        completedAttempts.length > 0
          ? (completedAttempts.filter((a) => (a.score || 0) >= (quiz?.passing_score || 70))
              .length /
              completedAttempts.length) *
            100
          : 0,
    };
  };

  const openGradingDialog = (attempt: QuizAttempt) => {
    setSelectedAttempt(attempt);
    // Initialize grading answers for short answer questions
    const shortAnswerQuestions = attempt.answers.filter((ans) => {
      const question = questions.find((q) => q.id === ans.question_id);
      return question?.question_type === "short_answer";
    });

    setGradingAnswers(
      shortAnswerQuestions.map((ans) => ({
        question_id: ans.question_id,
        points_earned: ans.points_earned || 0,
        is_correct: ans.is_correct || false,
      }))
    );
    setGradingDialogOpen(true);
  };

  const handleGrade = async () => {
    if (!selectedAttempt) return;
    const success = await gradeShortAnswers(selectedAttempt.id, gradingAnswers);
    if (success) {
      setGradingDialogOpen(false);
      loadAttempts();
    }
  };

  const updateGradingAnswer = (questionId: string, pointsEarned: number, isCorrect: boolean) => {
    setGradingAnswers((prev) =>
      prev.map((ans) =>
        ans.question_id === questionId
          ? { ...ans, points_earned: pointsEarned, is_correct: isCorrect }
          : ans
      )
    );
  };

  const stats = calculateStats();

  const getScoreBadge = (score: number, passingScore: number) => {
    if (score >= passingScore) {
      return <Badge variant="live" className="bg-green-500">{score.toFixed(1)}%</Badge>;
    } else if (score >= passingScore * 0.7) {
      return <Badge variant="default">{score.toFixed(1)}%</Badge>;
    } else {
      return <Badge variant="destructive">{score.toFixed(1)}%</Badge>;
    }
  };

  if (loading || !quiz) {
    return (
      <DashboardLayout role="teacher">
        <div className="flex items-center justify-center h-64">
          <p>Loading quiz results...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/dashboard/teacher/quizzes")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">{quiz.title}</h1>
              <p className="text-muted-foreground mt-1">Quiz Results & Analytics</p>
            </div>
          </div>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Results
          </Button>
        </div>

        {/* Stats Overview */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Attempts</p>
                <p className="text-2xl font-bold">{stats.totalAttempts}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Target className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Average Score</p>
                <p className="text-2xl font-bold">{stats.averageScore.toFixed(1)}%</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pass Rate</p>
                <p className="text-2xl font-bold">{stats.passRate.toFixed(0)}%</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Clock className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg. Time</p>
                <p className="text-2xl font-bold">
                  {attempts.length > 0
                    ? Math.round(
                        attempts.reduce((sum, a) => sum + (a.time_spent_seconds || 0), 0) /
                          attempts.length /
                          60
                      )
                    : 0}
                  m
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="attempts" className="space-y-4">
          <TabsList>
            <TabsTrigger value="attempts">Student Attempts</TabsTrigger>
            <TabsTrigger value="questions">Question Analysis</TabsTrigger>
          </TabsList>

          {/* Student Attempts Tab */}
          <TabsContent value="attempts">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Attempt</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Time Spent</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attempts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No submissions yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    attempts.map((attempt) => (
                      <TableRow key={attempt.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{attempt.student?.display_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {attempt.student?.email}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">Attempt {attempt.attempt_number}</Badge>
                        </TableCell>
                        <TableCell>
                          {attempt.score !== null && attempt.score !== undefined ? (
                            getScoreBadge(attempt.score, quiz.passing_score || 70)
                          ) : (
                            <Badge variant="secondary">Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {attempt.time_spent_seconds
                            ? `${Math.floor(attempt.time_spent_seconds / 60)}m ${
                                attempt.time_spent_seconds % 60
                              }s`
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {attempt.submitted_at
                            ? format(new Date(attempt.submitted_at), "MMM d, h:mm a")
                            : "In Progress"}
                        </TableCell>
                        <TableCell>
                          {attempt.status === "graded" ? (
                            <Badge variant="live">
                              <Check className="h-3 w-3 mr-1" />
                              Graded
                            </Badge>
                          ) : attempt.status === "submitted" ? (
                            <Badge variant="default">
                              <Clock className="h-3 w-3 mr-1" />
                              Needs Grading
                            </Badge>
                          ) : (
                            <Badge variant="secondary">In Progress</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {attempt.status === "submitted" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openGradingDialog(attempt)}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Grade
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Question Analysis Tab */}
          <TabsContent value="questions">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Question Performance</h3>
              <div className="space-y-4">
                {questions.map((question, index) => {
                  const questionAnswers = attempts.flatMap((a) =>
                    a.answers.filter((ans) => ans.question_id === question.id)
                  );
                  const correctCount = questionAnswers.filter((ans) => ans.is_correct).length;
                  const totalCount = questionAnswers.length;
                  const accuracy = totalCount > 0 ? (correctCount / totalCount) * 100 : 0;

                  return (
                    <div key={question.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-medium">
                            Question {index + 1}: {question.question_text}
                          </p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {question.question_type.replace("_", " ")} • {question.points} points
                          </p>
                        </div>
                        <Badge
                          variant={accuracy >= 70 ? "live" : accuracy >= 50 ? "default" : "destructive"}
                        >
                          {accuracy.toFixed(0)}% correct
                        </Badge>
                      </div>
                      <div className="mt-2">
                        <div className="w-full bg-secondary rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              accuracy >= 70
                                ? "bg-green-500"
                                : accuracy >= 50
                                ? "bg-blue-500"
                                : "bg-red-500"
                            }`}
                            style={{ width: `${accuracy}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {correctCount} out of {totalCount} correct
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Grading Dialog */}
      <Dialog open={gradingDialogOpen} onOpenChange={setGradingDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Grade Short Answer Questions</DialogTitle>
            <DialogDescription>
              Review and assign points to short answer questions for{" "}
              {selectedAttempt?.student?.display_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {selectedAttempt?.answers
              .filter((ans) => {
                const question = questions.find((q) => q.id === ans.question_id);
                return question?.question_type === "short_answer";
              })
              .map((answer, index) => {
                const question = questions.find((q) => q.id === answer.question_id);
                if (!question) return null;

                const gradingAnswer = gradingAnswers.find(
                  (ga) => ga.question_id === answer.question_id
                );

                return (
                  <Card key={answer.question_id} className="p-4">
                    <h4 className="font-medium mb-2">Question {index + 1}</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      {question.question_text}
                    </p>

                    <div className="bg-secondary/50 p-3 rounded-lg mb-3">
                      <Label className="text-xs text-muted-foreground">Student Answer:</Label>
                      <p className="text-sm mt-1">{answer.answer as string}</p>
                    </div>

                    {question.correct_answer && (
                      <div className="bg-secondary/30 p-3 rounded-lg mb-3">
                        <Label className="text-xs text-muted-foreground">
                          Sample Correct Answer:
                        </Label>
                        <p className="text-sm mt-1">{question.correct_answer}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`points-${answer.question_id}`}>
                          Points Earned (Max: {question.points})
                        </Label>
                        <Input
                          id={`points-${answer.question_id}`}
                          type="number"
                          min="0"
                          max={question.points}
                          step="0.5"
                          value={gradingAnswer?.points_earned || 0}
                          onChange={(e) =>
                            updateGradingAnswer(
                              answer.question_id,
                              parseFloat(e.target.value) || 0,
                              gradingAnswer?.is_correct || false
                            )
                          }
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          variant={gradingAnswer?.is_correct ? "default" : "outline"}
                          className="w-full"
                          onClick={() =>
                            updateGradingAnswer(
                              answer.question_id,
                              gradingAnswer?.is_correct ? 0 : question.points,
                              !gradingAnswer?.is_correct
                            )
                          }
                        >
                          {gradingAnswer?.is_correct ? (
                            <>
                              <Check className="h-4 w-4 mr-2" />
                              Correct
                            </>
                          ) : (
                            <>
                              <X className="h-4 w-4 mr-2" />
                              Mark Correct
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setGradingDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleGrade}>Save Grades</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default TeacherQuizResults;
