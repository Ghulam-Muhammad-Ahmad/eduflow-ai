import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, MoreVertical, Edit, Trash2, Eye, Lock, Unlock, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuizzes, Quiz } from "@/hooks/useQuizzes";
import { useClassrooms } from "@/hooks/useClassrooms";
import { useOneToOneRooms } from "@/hooks/useOneToOneRooms";
import { format, isPast, isFuture } from "date-fns";

const TeacherQuizzes = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { fetchTeacherQuizzes, deleteQuiz, publishQuiz, closeQuiz, loading } = useQuizzes();
  const { classrooms = [] } = useClassrooms();
  const { oneToOneRooms = [] } = useOneToOneRooms();

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [filteredQuizzes, setFilteredQuizzes] = useState<Quiz[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roomFilter, setRoomFilter] = useState<string>("all"); // "all" | classroom:id | roomId (1v1)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);

  const loadQuizzes = useCallback(async () => {
    if (!user?.id) return;
    const data = await fetchTeacherQuizzes(user.id);
    setQuizzes(data);
  }, [fetchTeacherQuizzes, user?.id]);

  useEffect(() => {
    if (user?.id) {
      loadQuizzes();
    }
  }, [loadQuizzes, user?.id]);

  useEffect(() => {
    filterQuizzes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizzes, searchTerm, statusFilter, roomFilter]);

  /** Quiz is closed: either teacher set status closed or end date (available_until) has passed */
  const isQuizClosed = (quiz: Quiz) =>
    quiz.status === "closed" || (!!quiz.available_until && isPast(new Date(quiz.available_until)));

  /** Display status derived from DB status + available_from / available_until */
  type DisplayStatus = "draft" | "scheduled" | "upcoming" | "active" | "closed";
  const getDisplayStatus = (quiz: Quiz): DisplayStatus => {
    if (quiz.status === "draft") return "draft";
    if (isQuizClosed(quiz)) return "closed";
    if (quiz.available_from && isFuture(new Date(quiz.available_from))) return "upcoming";
    return quiz.status === "scheduled" ? "scheduled" : "active";
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

    // Status filter: use display status so "Active" = in window, "Closed" = status closed or end date passed
    if (statusFilter !== "all") {
      filtered = filtered.filter((quiz) => getDisplayStatus(quiz) === statusFilter);
    }

    // Classroom or 1v1 room filter
    if (roomFilter !== "all") {
      if (roomFilter.startsWith("classroom:")) {
        const id = roomFilter.replace("classroom:", "");
        filtered = filtered.filter((quiz) => quiz.classroom_id === id);
      } else {
        filtered = filtered.filter((quiz) => (quiz as Quiz & { one_to_one_room_id?: string }).one_to_one_room_id === roomFilter);
      }
    }

    setFilteredQuizzes(filtered);
  };

  const handleDelete = async () => {
    if (!selectedQuiz) return;
    const success = await deleteQuiz(selectedQuiz.id);
    if (success) {
      setQuizzes(quizzes.filter((q) => q.id !== selectedQuiz.id));
      setDeleteDialogOpen(false);
      setSelectedQuiz(null);
    }
  };

  const handlePublish = async (quiz: Quiz) => {
    const success = await publishQuiz(quiz.id);
    if (success) {
      loadQuizzes();
    }
  };

  const handleClose = async (quiz: Quiz) => {
    const success = await closeQuiz(quiz.id);
    if (success) {
      loadQuizzes();
    }
  };

  const getQuestionCount = (quiz: Quiz) => {
    const extended = quiz as Quiz & {
      quiz_questions?: { id: string }[];
      questions?: unknown[];
      questionCount?: number;
      question_count?: number;
    };
    if (Array.isArray(extended.quiz_questions)) {
      return extended.quiz_questions.length;
    }
    if (Array.isArray(extended.questions)) {
      return extended.questions.length;
    }
    if (typeof extended.questionCount === "number") {
      return extended.questionCount;
    }
    if (typeof extended.question_count === "number") {
      return extended.question_count;
    }
    return 0;
  };

  const getStatusBadge = (quiz: Quiz) => {
    const displayStatus = getDisplayStatus(quiz);
    const variants: Record<DisplayStatus, { variant: "secondary" | "default" | "live" | "neutral"; label: string; className?: string }> = {
      draft: { variant: "secondary", label: "Draft" },
      scheduled: { variant: "default", label: "Scheduled" },
      upcoming: { variant: "secondary", label: "Upcoming" },
      active: { variant: "live", label: "Active" },
      closed: { variant: "neutral", label: "Closed", className: "border-orange-500/50 bg-orange-500/10 text-orange-700 dark:text-orange-400" },
    };
    const config = variants[displayStatus];
    return <Badge variant={config.variant} className={config.className}>{config.label}</Badge>;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Not set";
    return format(new Date(dateString), "MMM d, yyyy h:mm a");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Quizzes</h1>
            <p className="text-muted-foreground mt-1">
              Create and manage quizzes for your classrooms
            </p>
          </div>
          <Button
            onClick={() => router.push("/dashboard/teacher/quizzes/create")}
            size="lg"
          >
            <Plus className="h-5 w-5 mr-2" />
            Create Quiz
          </Button>
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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={roomFilter} onValueChange={setRoomFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Classroom / 1v1" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All (Classrooms & 1v1)</SelectItem>
                {classrooms?.map((c) => (
                  <SelectItem key={c.id} value={`classroom:${c.id}`}>
                    {c.name}
                  </SelectItem>
                ))}
                {oneToOneRooms?.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name || `${r.studentProfile?.display_name ?? "Student"} (1v1)`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Quizzes Table */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Classroom / 1v1 Room</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Questions</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Loading quizzes...
                  </TableCell>
                </TableRow>
              ) : filteredQuizzes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-muted-foreground">No quizzes found</p>
                      <Button
                        variant="outline"
                        onClick={() => router.push("/dashboard/teacher/quizzes/create")}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Create Your First Quiz
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredQuizzes.map((quiz) => (
                  <TableRow key={quiz.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{quiz.title}</p>
                        {quiz.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {quiz.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        {(quiz as Quiz & { one_to_one_rooms?: { name: string | null } }).one_to_one_rooms ? (
                          <p className="text-sm font-medium">
                            {(quiz as Quiz & { one_to_one_rooms?: { name: string | null } }).one_to_one_rooms?.name || "1v1 Room"}
                          </p>
                        ) : (
                          <>
                            <p className="text-sm font-medium">{quiz.classroom?.name}</p>
                            {quiz.classroom?.subject && (
                              <p className="text-xs text-muted-foreground">
                                {quiz.classroom.subject}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(quiz)}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {quiz.available_from && (
                          <p>From: {formatDate(quiz.available_from)}</p>
                        )}
                        {quiz.available_until && (
                          <p>Until: {formatDate(quiz.available_until)}</p>
                        )}
                        {!quiz.available_from && !quiz.available_until && (
                          <p className="text-muted-foreground">Always available</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Clock className="h-3 w-3" />
                        {quiz.time_limit_minutes ? `${quiz.time_limit_minutes} min` : "No limit"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">
                        {getQuestionCount(quiz) === 0 && (quiz.quiz_attachments?.length ?? 0) > 0
                          ? "Document-based"
                          : `${getQuestionCount(quiz)} question${getQuestionCount(quiz) !== 1 ? "s" : ""}`}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              router.push(`/dashboard/teacher/quizzes/${quiz.id}/results`)
                            }
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Results
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              router.push(`/dashboard/teacher/quizzes/${quiz.id}/edit`)
                            }
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {quiz.status === "draft" && (
                            <DropdownMenuItem onClick={() => handlePublish(quiz)}>
                              <Unlock className="h-4 w-4 mr-2" />
                              Publish
                            </DropdownMenuItem>
                          )}
                          {quiz.status === "active" && (
                            <DropdownMenuItem onClick={() => handleClose(quiz)}>
                              <Lock className="h-4 w-4 mr-2" />
                              Close
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedQuiz(quiz);
                              setDeleteDialogOpen(true);
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quiz</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedQuiz?.title}&quot;? This action cannot
              be undone and will delete all student attempts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default TeacherQuizzes;
