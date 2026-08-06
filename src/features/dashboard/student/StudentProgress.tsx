import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useStudentAssignments } from "@/hooks/useAssignments";
import { useQuizzes, type Quiz, type QuizAttempt } from "@/hooks/useQuizzes";
import { computeStudentRecordAverages } from "@/lib/studentRecord";
import type { AssignmentGrade, QuizGrade, StudentRecord } from "@/hooks/useTeacherStudentRecords";
import { StudentRecordView } from "@/features/dashboard/teacher/StudentRecordView";
import { generateStudentPDF } from "@/lib/pdfReports";
import { useToast } from "@/hooks/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { TrendingUp } from "lucide-react";

/**
 * The student's own progress report — combines every classroom and 1v1 room they're in
 * into a single StudentRecord, reusing the same view and PDF export teachers/owners use.
 * A single student sees one report here; a per-room breakdown lives on the 1v1 room
 * detail page instead.
 */
const StudentProgress = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: assignments = [], isLoading: assignmentsLoading } = useStudentAssignments();
  const { fetchStudentQuizzes, fetchStudentAttempts } = useQuizzes();

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [quizzesLoading, setQuizzesLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    setQuizzesLoading(true);
    Promise.all([fetchStudentQuizzes(user.id), fetchStudentAttempts(user.id)]).then(
      ([quizData, attemptData]) => {
        setQuizzes(quizData);
        setAttempts(attemptData);
        setQuizzesLoading(false);
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const record: StudentRecord | null = useMemo(() => {
    if (!user) return null;

    const assignmentGrades: AssignmentGrade[] = assignments.map((a) => ({
      assignment_id: a.id,
      title: a.title,
      points_possible: a.points_possible ?? null,
      grade: a.mySubmission?.grade ?? null,
      status: a.mySubmission?.status ?? "not_submitted",
      submitted_at: a.mySubmission?.submitted_at ?? null,
      graded_at: a.mySubmission?.graded_at ?? null,
      classroom_name: a.classrooms?.name ?? a.one_to_one_rooms?.name ?? "1v1 session",
    }));

    const gradedAttempts = attempts.filter((a) => a.status === "submitted" || a.status === "graded");
    const quizGrades: QuizGrade[] = gradedAttempts.map((a) => {
      const quiz = quizzes.find((q) => q.id === a.quiz_id);
      return {
        quiz_id: a.quiz_id,
        title: quiz?.title ?? "Quiz",
        attempt_number: a.attempt_number,
        score: a.score ?? null,
        points_earned: a.points_earned ?? null,
        points_possible: a.points_possible ?? null,
        status: a.status,
        submitted_at: a.submitted_at ?? null,
        classroom_name: quiz?.classroom?.name ?? quiz?.one_to_one_rooms?.name ?? "1v1 session",
      };
    });

    const { assignmentAvg, quizAvg, overallAvg, gradedQuizzesCount } = computeStudentRecordAverages(
      assignmentGrades,
      quizGrades
    );
    const gradedAssignmentsCount = assignmentGrades.filter((g) => g.grade != null).length;

    return {
      student_id: user.id,
      display_name: user.user_metadata?.display_name ?? user.email?.split("@")[0] ?? null,
      avatar_url: null,
      classroom_id: "",
      classroom_name: "All classes & rooms",
      joined_at: user.created_at ?? new Date().toISOString(),
      assignmentGrades,
      quizGrades,
      assignmentAvg,
      quizAvg,
      overallAvg,
      totalAssignments: assignmentGrades.length,
      totalQuizzes: quizzes.length,
      gradedAssignments: gradedAssignmentsCount,
      gradedQuizzes: gradedQuizzesCount,
    };
  }, [user, assignments, attempts, quizzes]);

  const handleExportPDF = (student: StudentRecord) => {
    try {
      const doc = generateStudentPDF(student, format(new Date(), "PPpp"));
      const name = (student.display_name || "student").replace(/\s+/g, "-");
      doc.save(`my-progress-${name}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast({ title: "PDF exported" });
    } catch (err) {
      toast({
        title: "Export failed",
        description: (err as Error)?.message,
        variant: "destructive",
      });
    }
  };

  const isLoading = assignmentsLoading || quizzesLoading;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="h-7 w-7 text-primary" />
            My Progress
          </h1>
          <p className="text-muted-foreground mt-1">
            Your grades and activity across every class and 1v1 room. Export a PDF to share with a parent.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : record ? (
          <StudentRecordView student={record} onExportPDF={handleExportPDF} />
        ) : null}
      </div>
    </DashboardLayout>
  );
};

export default StudentProgress;
