import { useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useStudentAssignments } from "@/hooks/useAssignments";
import { useClassrooms } from "@/hooks/useClassrooms";
import SubmitAssignmentDialog from "@/components/student/SubmitAssignmentDialog";
import AttachedDocuments, { toAttachedDocuments } from "@/components/student/AttachedDocuments";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ClipboardCheck,
  Calendar,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Send,
} from "lucide-react";
import { format, isPast, isWithinInterval, addDays } from "date-fns";

interface AssignmentWithSubmission {
  id: string;
  title?: string;
  description?: string | null;
  due_date?: string | null;
  points_possible?: number | null;
  classrooms?: { id?: string; name?: string; subject?: string | null } | null;
  mySubmission?: { grade: number | null; is_late?: boolean | null } | null;
  assignment_attachments?: { documents?: { id: string; name: string; file_path: string; file_type: string } }[];
  [key: string]: unknown;
}

const StudentAssignments = () => {
  const [classroomFilter, setClassroomFilter] = useState<string>("all");
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentWithSubmission | null>(null);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);

  const { data: assignments, isLoading } = useStudentAssignments(
    classroomFilter === "all" ? undefined : classroomFilter
  );
  const { classrooms } = useClassrooms();

  const getAssignmentStatus = (assignment: AssignmentWithSubmission) => {
    const hasSubmission = assignment.mySubmission;
    const dueDate = assignment.due_date ? new Date(assignment.due_date) : null;
    const isOverdue = dueDate && isPast(dueDate);
    const isDueSoon =
      dueDate &&
      !isOverdue &&
      isWithinInterval(dueDate, {
        start: new Date(),
        end: addDays(new Date(), 3),
      });

    if (hasSubmission && assignment.mySubmission) {
      if (assignment.mySubmission.grade !== null) {
        return { status: "graded", label: "Graded", variant: "default" as const };
      }
      return { status: "submitted", label: "Submitted", variant: "secondary" as const };
    }

    if (isOverdue) {
      return { status: "overdue", label: "Overdue", variant: "destructive" as const };
    }

    if (isDueSoon) {
      return { status: "due-soon", label: "Due Soon", variant: "outline" as const };
    }

    return { status: "pending", label: "Not Started", variant: "outline" as const };
  };

  const pendingAssignments = assignments?.filter((a) => {
    const status = getAssignmentStatus(a);
    return status.status === "pending" || status.status === "due-soon" || status.status === "overdue";
  });

  const submittedAssignments = assignments?.filter((a) => {
    const status = getAssignmentStatus(a);
    return status.status === "submitted" || status.status === "graded";
  });

  const openSubmitDialog = (assignment: AssignmentWithSubmission) => {
    setSelectedAssignment(assignment);
    setSubmitDialogOpen(true);
  };

  const renderAssignmentCard = (assignment: AssignmentWithSubmission) => {
    const status = getAssignmentStatus(assignment);
    const dueDate = assignment.due_date ? new Date(assignment.due_date) : null;
    const attachments = toAttachedDocuments(assignment.assignment_attachments);

    return (
      <Card
        key={assignment.id}
        className="group hover:shadow-lg transition-shadow"
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge variant={status.variant}>{status.label}</Badge>
                {assignment.mySubmission?.is_late && (
                  <Badge variant="destructive" className="text-xs">
                    Late
                  </Badge>
                )}
              </div>
              <CardTitle className="text-lg truncate">
                <Link
                  href={`/dashboard/student/assignments/${assignment.id}`}
                  className="hover:underline"
                >
                  {assignment.title}
                </Link>
              </CardTitle>
              <CardDescription className="truncate">
                {assignment.classrooms && typeof assignment.classrooms === "object"
                  ? (assignment.classrooms as { name?: string }).name ?? ""
                  : ""}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {assignment.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {assignment.description}
            </p>
          )}

          <AttachedDocuments documents={attachments} title="Attached materials" compact />

          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
            {dueDate && (
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>{format(dueDate, "MMM d, yyyy")}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <FileText className="w-4 h-4" />
              <span>{assignment.points_possible ?? 0} pts</span>
            </div>
            {status.status === "graded" && assignment.mySubmission && (
              <div className="flex items-center gap-1 text-accent">
                <CheckCircle className="w-4 h-4" />
                <span>
                  {assignment.mySubmission.grade}/{assignment.points_possible ?? 0}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Button variant="outline" className="w-full gap-2" asChild>
              <Link href={`/dashboard/student/assignments/${assignment.id}`}>
                <FileText className="w-4 h-4" />
                View details
              </Link>
            </Button>
            {status.status !== "graded" && (
              <Button
                variant={status.status === "submitted" ? "outline" : "default"}
                className="w-full gap-2"
                onClick={() => openSubmitDialog(assignment)}
              >
                {status.status === "submitted" ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    View Submission
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Submit Assignment
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">My Assignments</h1>
            <p className="text-muted-foreground mt-1">
              View and submit your class assignments
            </p>
          </div>
          <Select value={classroomFilter} onValueChange={setClassroomFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classrooms?.map((classroom) => (
                <SelectItem key={classroom.id} value={classroom.id}>
                  {classroom.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="feature-icon-indigo">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{assignments?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Assignments</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="feature-icon-amber">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pendingAssignments?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="feature-icon-emerald">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{submittedAssignments?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">Submitted</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-secondary rounded w-3/4" />
                  <div className="h-4 bg-secondary rounded w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <div className="h-20 bg-secondary rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && (!assignments || assignments.length === 0) && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="feature-icon-indigo mb-4">
                <ClipboardCheck className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No assignments yet</h3>
              <p className="text-muted-foreground text-center mb-6 max-w-sm">
                Your teachers haven&apos;t published any assignments yet. Check back later!
              </p>
            </CardContent>
          </Card>
        )}

        {/* Assignments Tabs */}
        {!isLoading && assignments && assignments.length > 0 && (
          <Tabs defaultValue="pending">
            <TabsList>
              <TabsTrigger value="pending" className="gap-2">
                <AlertCircle className="w-4 h-4" />
                To Do ({pendingAssignments?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="submitted" className="gap-2">
                <CheckCircle className="w-4 h-4" />
                Submitted ({submittedAssignments?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="all">
                All ({assignments?.length || 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="mt-6">
              {pendingAssignments && pendingAssignments.length > 0 ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {pendingAssignments.map(renderAssignmentCard)}
                </div>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <CheckCircle className="w-12 h-12 text-accent mb-3" />
                    <h3 className="text-lg font-semibold">All caught up!</h3>
                    <p className="text-muted-foreground text-center">
                      You&apos;ve submitted all your pending assignments.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="submitted" className="mt-6">
              {submittedAssignments && submittedAssignments.length > 0 ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {submittedAssignments.map(renderAssignmentCard)}
                </div>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Send className="w-12 h-12 text-muted-foreground mb-3" />
                    <h3 className="text-lg font-semibold">No submissions yet</h3>
                    <p className="text-muted-foreground text-center">
                      Submit your first assignment to see it here.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="all" className="mt-6">
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {assignments.map(renderAssignmentCard)}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Submit Dialog */}
      {selectedAssignment && (
        <SubmitAssignmentDialog
          open={submitDialogOpen}
          onOpenChange={setSubmitDialogOpen}
          assignment={selectedAssignment}
        />
      )}
    </DashboardLayout>
  );
};

export default StudentAssignments;
