import { useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useStudentAssignments } from "@/hooks/useAssignments";
import { useClassrooms } from "@/hooks/useClassrooms";
import SubmitAssignmentDialog from "@/components/student/SubmitAssignmentDialog";
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
  Download,
  Paperclip,
} from "lucide-react";
import { format, isPast, isWithinInterval, addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const StudentAssignments = () => {
  const [classroomFilter, setClassroomFilter] = useState<string>("all");
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);

  const { data: assignments, isLoading } = useStudentAssignments(
    classroomFilter === "all" ? undefined : classroomFilter
  );
  const { classrooms } = useClassrooms();

  const getAssignmentStatus = (assignment: any) => {
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

    if (hasSubmission) {
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

  const openSubmitDialog = (assignment: any) => {
    setSelectedAssignment(assignment);
    setSubmitDialogOpen(true);
  };

  const downloadAttachment = async (doc: { name: string; file_path: string }) => {
    try {
      const { data, error } = await supabase.storage
        .from("documents")
        .download(doc.file_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.name;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Document downloaded");
    } catch (error) {
      console.error("Error downloading:", error);
      toast.error("Failed to download document");
    }
  };

  const getAttachments = (assignment: any) => {
    const attachments = assignment?.assignment_attachments ?? [];
    return attachments
      .map((a: any) => a.documents)
      .filter(Boolean) as { id: string; name: string; file_path: string; file_type: string }[];
  };

  const renderAssignmentCard = (assignment: any) => {
    const status = getAssignmentStatus(assignment);
    const dueDate = assignment.due_date ? new Date(assignment.due_date) : null;

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
              <CardTitle className="text-lg truncate">{assignment.title}</CardTitle>
              <CardDescription className="truncate">
                {assignment.classrooms?.name}
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

          {getAttachments(assignment).length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Paperclip className="w-3.5 h-3.5" />
                Attached materials
              </p>
              <div className="flex flex-wrap gap-2">
                {getAttachments(assignment).map((doc) => (
                  <Button
                    key={doc.id}
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadAttachment(doc);
                    }}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span className="truncate max-w-[120px]">{doc.name}</span>
                    <Download className="w-3 h-3 shrink-0" />
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
            {dueDate && (
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>{format(dueDate, "MMM d, yyyy")}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <FileText className="w-4 h-4" />
              <span>{assignment.points_possible} pts</span>
            </div>
            {status.status === "graded" && (
              <div className="flex items-center gap-1 text-accent">
                <CheckCircle className="w-4 h-4" />
                <span>
                  {assignment.mySubmission.grade}/{assignment.points_possible}
                </span>
              </div>
            )}
          </div>

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
                Your teachers haven't published any assignments yet. Check back later!
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
                      You've submitted all your pending assignments.
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
