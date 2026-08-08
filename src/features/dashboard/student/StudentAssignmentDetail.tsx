import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useStudentAssignment } from "@/hooks/useAssignments";
import SubmitAssignmentDialog from "@/components/student/SubmitAssignmentDialog";
import AttachedDocuments, { toAttachedDocuments } from "@/components/student/AttachedDocuments";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { ArrowLeft, Calendar, CheckCircle, FileText, Send } from "lucide-react";
import { format, isPast } from "date-fns";

export default function StudentAssignmentDetail() {
  const router = useRouter();
  const assignmentId =
    typeof router.query.assignmentId === "string" ? router.query.assignmentId : null;
  const { data: assignment, isLoading } = useStudentAssignment(assignmentId);
  const [submitOpen, setSubmitOpen] = useState(false);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-16">
          <Spinner size="lg" className="text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!assignment) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-16">
          <p className="mb-4 text-muted-foreground">
            This assignment is not available. It may have been unpublished or removed.
          </p>
          <Button variant="outline" asChild>
            <Link href="/dashboard/student/assignments">Back to Assignments</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const attachments = toAttachedDocuments(assignment.assignment_attachments);
  const submission = assignment.mySubmission;
  const dueDate = assignment.due_date ? new Date(assignment.due_date) : null;
  const isOverdue = dueDate ? isPast(dueDate) && !submission : false;
  const contextName =
    assignment.classrooms?.name ??
    assignment.one_to_one_rooms?.name ??
    (assignment.one_to_one_room_id ? "1v1 room" : "");

  const statusBadge = submission
    ? submission.grade !== null
      ? { label: "Graded", variant: "default" as const }
      : { label: "Submitted", variant: "secondary" as const }
    : isOverdue
      ? { label: "Overdue", variant: "destructive" as const }
      : { label: "Not started", variant: "outline" as const };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/student/assignments" aria-label="Back to assignments">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
              {submission?.is_late && (
                <Badge variant="destructive" className="text-xs">
                  Late
                </Badge>
              )}
            </div>
            <h1 className="text-2xl font-bold lg:text-3xl">{assignment.title}</h1>
            {contextName && <p className="mt-1 text-muted-foreground">{contextName}</p>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          {dueDate && (
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              Due {format(dueDate, "MMM d, yyyy h:mm a")}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            {assignment.points_possible ?? 0} pts
          </span>
          {submission?.grade !== null && submission?.grade !== undefined && (
            <span className="flex items-center gap-1.5 text-accent">
              <CheckCircle className="h-4 w-4" />
              {submission.grade}/{assignment.points_possible ?? 0}
            </span>
          )}
        </div>

        {(assignment.description || assignment.instructions) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {assignment.description && (
                <p className="text-sm text-muted-foreground">{assignment.description}</p>
              )}
              {assignment.instructions && (
                <div className="rounded-lg bg-secondary/50 p-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Instructions</p>
                  <p className="whitespace-pre-wrap text-sm">{assignment.instructions}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reference materials</CardTitle>
            <CardDescription>
              PDFs and documents your tutor attached to this assignment.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AttachedDocuments
              documents={attachments}
              title="Files"
              emptyLabel="Your tutor hasn't attached any files to this assignment."
            />
          </CardContent>
        </Card>

        {submission && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your submission</CardTitle>
              <CardDescription>
                Submitted {format(new Date(submission.submitted_at), "MMM d, yyyy h:mm a")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {submission.text_content && (
                <p className="whitespace-pre-wrap rounded-lg bg-secondary/50 p-3 text-sm">
                  {submission.text_content}
                </p>
              )}
              {submission.feedback && (
                <div className="rounded-lg border border-border p-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Tutor feedback</p>
                  <p className="whitespace-pre-wrap text-sm">{submission.feedback}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Button className="gap-2" onClick={() => setSubmitOpen(true)}>
          {submission ? (
            <>
              <CheckCircle className="h-4 w-4" />
              View / resubmit
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Submit assignment
            </>
          )}
        </Button>
      </div>

      <SubmitAssignmentDialog
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        assignment={assignment}
      />
    </DashboardLayout>
  );
}
