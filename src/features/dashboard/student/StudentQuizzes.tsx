import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Search, Clock, Target, Calendar, Play, Eye, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuizzes, Quiz, QuizAttempt } from "@/hooks/useQuizzes";
import { useClassrooms } from "@/hooks/useClassrooms";
import { format, isPast, isFuture } from "date-fns";

const StudentQuizzes = () => {
  const router = useRouter();
  const { user } = useAuth();
  const {
    fetchStudentQuizzes,
    fetchStudentAttempts,
    checkCanAttemptQuiz,
    loading,
  } = useQuizzes();
  const { classrooms: enrolledClassrooms = [] } = useClassrooms();

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [filteredQuizzes, setFilteredQuizzes] = useState<Quiz[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [classroomFilter, setClassroomFilter] = useState<string>("all");

  useEffect(() => {
    if (user?.id) {
      loadQuizzes();
      loadAttempts();
    }
  }, [user]);

  useEffect(() => {
    filterQuizzes();
  }, [quizzes, searchTerm, classroomFilter]);

  const loadQuizzes = async () => {
    if (!user?.id) return;
    const data = await fetchStudentQuizzes(user.id);
    setQuizzes(data);
  };

  const loadAttempts = async () => {
    if (!user?.id) return;
    const data = await fetchStudentAttempts(user.id);
    setAttempts(data);
  };

  const filterQuizzes = () => {
    let filtered = [...quizzes];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (quiz) =>
          quiz.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          quiz.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Classroom filter
    if (classroomFilter !== "all") {
      filtered = filtered.filter((quiz) => quiz.classroom_id === classroomFilter);
    }

    setFilteredQuizzes(filtered);
  };

  /** Quiz is closed: teacher set status closed or end date (available_until) has passed */
  const isQuizClosed = (quiz: Quiz) =>
    quiz.status === "closed" || (!!quiz.available_until && isPast(new Date(quiz.available_until)));

  const getQuizStatus = (quiz: Quiz) => {
    if (quiz.status === "draft") return null;

    if (isQuizClosed(quiz)) {
      return { label: "Closed", variant: "destructive" as const };
    }

    if (quiz.status !== "active" && quiz.status !== "scheduled") return null;

    if (quiz.available_from && isFuture(new Date(quiz.available_from))) {
      return { label: "Upcoming", variant: "secondary" as const };
    }

    if (quiz.status === "scheduled") {
      return { label: "Upcoming", variant: "secondary" as const };
    }

    return { label: "Available", variant: "live" as const };
  };

  const getAttemptInfo = (quizId: string) => {
    const quizAttempts = attempts.filter((a) => a.quiz_id === quizId);
    const completedAttempts = quizAttempts.filter((a) => a.status === "graded");
    const inProgressAttempt = quizAttempts.find((a) => a.status === "in_progress");

    // Find the best attempt (highest score) among completed attempts
    let bestAttempt = null;
    if (completedAttempts.length > 0) {
      bestAttempt = completedAttempts.reduce((best, current) => {
        return (current.score || 0) > (best.score || 0) ? current : best;
      });
    }

    return {
      total: quizAttempts.length,
      completed: completedAttempts.length,
      inProgress: inProgressAttempt,
      bestScore:
        completedAttempts.length > 0
          ? Math.max(...completedAttempts.map((a) => a.score || 0))
          : null,
      bestAttempt: bestAttempt, // The attempt with the highest score
      lastAttempt:
        quizAttempts.length > 0
          ? quizAttempts.reduce((latest, current) => {
              const latestTime = new Date(latest.updated_at || latest.created_at).getTime();
              const currentTime = new Date(current.updated_at || current.created_at).getTime();
              return currentTime > latestTime ? current : latest;
            })
          : null, // Most recent attempt
    };
  };

  const handleStartQuiz = async (quiz: Quiz) => {
    const attemptInfo = getAttemptInfo(quiz.id);

    // Check if there's an in-progress attempt
    if (attemptInfo.inProgress) {
      router.push(`/dashboard/student/quizzes/${quiz.id}/take/${attemptInfo.inProgress.id}`);
      return;
    }

    // Check if can attempt
    if (user?.id) {
      const canAttempt = await checkCanAttemptQuiz(quiz.id, user.id);
      if (!canAttempt.can_attempt) {
        alert(canAttempt.reason || "You cannot attempt this quiz");
        return;
      }
    }

    router.push(`/dashboard/student/quizzes/${quiz.id}/take`);
  };

  const availableQuizzes = filteredQuizzes.filter((quiz) => {
    const status = getQuizStatus(quiz);
    const attemptInfo = getAttemptInfo(quiz.id);
    return status?.label === "Available" && attemptInfo.completed === 0;
  });

  const submittedQuizzes = filteredQuizzes.filter((quiz) => {
    const status = getQuizStatus(quiz);
    const attemptInfo = getAttemptInfo(quiz.id);
    return status?.label === "Available" && attemptInfo.completed > 0;
  });

  const upcomingQuizzes = filteredQuizzes.filter((quiz) => {
    const status = getQuizStatus(quiz);
    return status?.label === "Upcoming";
  });

  const expiredQuizzes = filteredQuizzes.filter((quiz) => {
    return isQuizClosed(quiz) || getQuizStatus(quiz)?.label === "Closed";
  });

  const QuizCard = ({ quiz }: { quiz: Quiz }) => {
    const status = getQuizStatus(quiz);
    const attemptInfo = getAttemptInfo(quiz.id);

    return (
      <Card className="p-5 hover:shadow-lg transition-shadow">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="font-semibold text-lg text-foreground mb-1">{quiz.title}</h3>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {quiz.description || "No description"}
            </p>
          </div>
          {status && (
              <Badge
                variant={status.variant}
                className={
                  status.label === "Closed"
                    ? "border-orange-500/50 bg-orange-500/10 text-orange-700 dark:text-orange-400"
                    : status.label === "Available" && attemptInfo.completed > 0
                      ? "border-orange-500/50 bg-orange-500/10 text-orange-700 dark:text-orange-400"
                      : undefined
                }
              >
                {status.label === "Available" && attemptInfo.completed > 0 ? "Submitted" : status.label}
              </Badge>
            )}
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Target className="h-4 w-4" />
              <span>{quiz.classroom?.name}</span>
            </div>
            {quiz.time_limit_minutes && (
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{quiz.time_limit_minutes} min</span>
              </div>
            )}
          </div>

          {quiz.available_until && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Due: {format(new Date(quiz.available_until), "MMM d, yyyy h:mm a")}</span>
            </div>
          )}

          {attemptInfo.completed > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>
                Best Score: <strong>{attemptInfo.bestScore?.toFixed(1)}%</strong>
                {quiz.max_attempts != null && quiz.max_attempts > 0 && (
                  <span className="ml-1">
                    ({Math.min(attemptInfo.completed, quiz.max_attempts)}/{quiz.max_attempts} {quiz.max_attempts === 1 ? 'attempt' : 'attempts'})
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {attemptInfo.inProgress ? (
            <Button
              className="flex-1"
              onClick={() => handleStartQuiz(quiz)}
            >
              <Play className="h-4 w-4 mr-2" />
              Continue Quiz
            </Button>
          ) : status?.label === "Available" ? (
            <>
              <Button
                className="flex-1"
                onClick={() => handleStartQuiz(quiz)}
                disabled={
                  quiz.max_attempts !== null &&
                  attemptInfo.completed >= (quiz.max_attempts || 1)
                }
              >
                <Play className="h-4 w-4 mr-2" />
                {attemptInfo.completed > 0 ? "Retake Quiz" : "Start Quiz"}
              </Button>
              {attemptInfo.bestAttempt && (
                <Button
                  variant="outline"
                  onClick={() =>
                    router.push(
                      `/dashboard/student/quizzes/${quiz.id}/results/${attemptInfo.bestAttempt?.id}`
                    )
                  }
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Best Result
                </Button>
              )}
            </>
          ) : (
            <Button variant="outline" className="flex-1" disabled>
              {status?.label === "Upcoming" ? "Not Yet Available" : "Closed"}
            </Button>
          )}
        </div>
      </Card>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Quizzes</h1>
          <p className="text-muted-foreground mt-1">
            View and take quizzes from your classrooms
          </p>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search quizzes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={classroomFilter} onValueChange={setClassroomFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Classroom" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classrooms</SelectItem>
                {enrolledClassrooms && enrolledClassrooms.length > 0 ? (
                  enrolledClassrooms.map((classroom) => (
                    <SelectItem key={classroom.id} value={classroom.id}>
                      {classroom.name}
                    </SelectItem>
                  ))
                ) : null}
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="available" className="space-y-4">
          <TabsList>
            <TabsTrigger value="available">
              Available ({availableQuizzes.length})
            </TabsTrigger>
            <TabsTrigger value="upcoming">
              Upcoming ({upcomingQuizzes.length})
            </TabsTrigger>
            <TabsTrigger value="submitted">
              Submitted ({submittedQuizzes.length})
            </TabsTrigger>
            <TabsTrigger value="expired">
              Closed ({expiredQuizzes.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="available">
            {loading ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">Loading quizzes...</p>
              </Card>
            ) : availableQuizzes.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No available quizzes at the moment</p>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableQuizzes.map((quiz) => (
                  <QuizCard key={quiz.id} quiz={quiz} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="upcoming">
            {upcomingQuizzes.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No upcoming quizzes</p>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcomingQuizzes.map((quiz) => (
                  <QuizCard key={quiz.id} quiz={quiz} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="submitted">
            {submittedQuizzes.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No submitted quizzes</p>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {submittedQuizzes.map((quiz) => (
                  <QuizCard key={quiz.id} quiz={quiz} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="expired">
            {expiredQuizzes.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No closed quizzes</p>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {expiredQuizzes.map((quiz) => (
                  <QuizCard key={quiz.id} quiz={quiz} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default StudentQuizzes;
