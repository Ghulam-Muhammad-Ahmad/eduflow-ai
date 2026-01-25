import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAssignmentSubmissions } from "@/hooks/useAssignments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Download,
  FileText,
  Users,
  AlertCircle,
  Send,
  Brain,
} from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAIGrading } from "@/hooks/useAIGrading";

const TeacherAssignmentSubmissions = () => {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: submissions, isLoading } = useAssignmentSubmissions(assignmentId || null);
  
  const [gradeDialogOpen, setGradeDialogOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [grade, setGrade] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { gradeSubmissionWithAI, fetchAIFeedback, loading: aiGradingLoading } = useAIGrading();
  const [aiFeedbackLoading, setAIFeedbackLoading] = useState(false);

  // Get assignment details from first submission
  const assignment = submissions?.[0]?.assignments;

  const submittedCount = submissions?.filter((s) => s.status === "submitted" || s.status === "graded").length || 0;
  const gradedCount = submissions?.filter((s) => s.status === "graded").length || 0;
  const totalStudents = submissions?.length || 0;

  const openGradeDialog = async (submission: any) => {
    setSelectedSubmission(submission);
    setGrade(submission.grade?.toString() || "");
    setFeedback(submission.feedback || "");
    setGradeDialogOpen(true);
    
    // Try to load existing AI feedback
    if (submission.id) {
      const aiFeedback = await fetchAIFeedback(submission.id);
      if (aiFeedback && !aiFeedback.accepted) {
        // Pre-fill with AI feedback if available and not yet accepted
        setFeedback(aiFeedback.feedback_data.overall_feedback || submission.feedback || "");
      }
    }
  };

  const handleAIGrade = async () => {
    if (!selectedSubmission || !assignment) return;

    setAIFeedbackLoading(true);
    try {
      let submissionText = selectedSubmission.text_content || "";
      if (selectedSubmission.file_path && !submissionText) {
        submissionText = "[File submission - text extraction needed]";
      }

      const result = await gradeSubmissionWithAI(
        selectedSubmission.id,
        submissionText,
        assignment.description || assignment.title,
        undefined // rubric can be added later
      );

      if (result?.success) {
        setFeedback(result.content);
        toast.success("AI feedback generated! Review and modify as needed.");
      } else {
        toast.error(result?.error || "Failed to generate AI feedback");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to generate AI feedback");
    } finally {
      setAIFeedbackLoading(false);
    }
  };

  const handleGradeSubmission = async () => {
    if (!selectedSubmission) return;

    const gradeValue = parseFloat(grade);
    if (isNaN(gradeValue) || gradeValue < 0 || gradeValue > (assignment?.points_possible || 100)) {
      toast.error(`Grade must be between 0 and ${assignment?.points_possible || 100}`);
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("submissions")
        .update({
          grade: gradeValue,
          feedback: feedback.trim() || null,
          graded_at: new Date().toISOString(),
          status: "graded",
        })
        .eq("id", selectedSubmission.id);

      if (error) throw error;

      toast.success("Grade submitted successfully");
      queryClient.invalidateQueries({ queryKey: ["assignment-submissions", assignmentId] });
      setGradeDialogOpen(false);
      setSelectedSubmission(null);
      setGrade("");
      setFeedback("");
    } catch (error) {
      console.error("Error grading submission:", error);
      toast.error("Failed to submit grade");
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadSubmission = async (submission: any) => {
    if (!submission.file_path) {
      toast.error("No file to download");
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from("submissions")
        .download(submission.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = submission.file_name || "submission";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("File downloaded");
    } catch (error) {
      console.error("Error downloading:", error);
      toast.error("Failed to download file");
    }
  };

  const getStatusBadge = (submission: any) => {
    if (submission.status === "graded") {
      return <Badge className="bg-accent">Graded</Badge>;
    }
    if (submission.status === "submitted") {
      return submission.is_late ? (
        <Badge variant="destructive">Late</Badge>
      ) : (
        <Badge variant="secondary">Submitted</Badge>
      );
    }
    return <Badge variant="outline">Not Submitted</Badge>;
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const completionRate = totalStudents > 0 ? (submittedCount / totalStudents) * 100 : 0;
  const gradingProgress = submittedCount > 0 ? (gradedCount / submittedCount) * 100 : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard/teacher/assignments")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl lg:text-3xl font-bold">
              {assignment?.title || "Assignment Submissions"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {assignment?.classrooms?.name || "Classroom"}
              {assignment?.due_date && (
                <span> • Due: {format(new Date(assignment.due_date), "MMM d, yyyy")}</span>
              )}
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="feature-icon-indigo">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalStudents}</p>
                  <p className="text-sm text-muted-foreground">Total Students</p>
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
                  <p className="text-2xl font-bold">{submittedCount}</p>
                  <p className="text-sm text-muted-foreground">Submitted</p>
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
                  <p className="text-2xl font-bold">{totalStudents - submittedCount}</p>
                  <p className="text-sm text-muted-foreground">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="feature-icon-indigo">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{gradedCount}</p>
                  <p className="text-sm text-muted-foreground">Graded</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Progress Indicators */}
        <div className="grid sm:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Completion Rate</CardTitle>
              <CardDescription>
                {submittedCount} of {totalStudents} students submitted
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={completionRate} className="h-3" />
              <p className="text-sm text-muted-foreground mt-2">
                {completionRate.toFixed(0)}% complete
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Grading Progress</CardTitle>
              <CardDescription>
                {gradedCount} of {submittedCount} submissions graded
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={gradingProgress} variant="gradient" className="h-3" />
              <p className="text-sm text-muted-foreground mt-2">
                {gradingProgress.toFixed(0)}% graded
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Submissions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Submissions</CardTitle>
            <CardDescription>
              View and grade student submissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!submissions || submissions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No submissions yet</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((submission) => {
                    const studentName = (submission.profiles as any)?.display_name || "Student";
                    return (
                      <TableRow key={submission.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={(submission.profiles as any)?.avatar_url} />
                              <AvatarFallback>
                                {studentName[0]?.toUpperCase() || "S"}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{studentName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {submission.submitted_at
                            ? format(new Date(submission.submitted_at), "MMM d, h:mm a")
                            : "-"}
                        </TableCell>
                        <TableCell>{getStatusBadge(submission)}</TableCell>
                        <TableCell>
                          {submission.grade !== null ? (
                            <span className="font-semibold">
                              {submission.grade}/{assignment?.points_possible || 100}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {submission.file_path && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => downloadSubmission(submission)}
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            )}
                            {submission.status === "submitted" || submission.status === "graded" ? (
                              <Button
                                size="sm"
                                onClick={() => openGradeDialog(submission)}
                              >
                                {submission.status === "graded" ? "Edit Grade" : "Grade"}
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Grade Submission Dialog */}
        <Dialog open={gradeDialogOpen} onOpenChange={setGradeDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Grade Submission</DialogTitle>
              <DialogDescription>
                {(selectedSubmission?.profiles as any)?.display_name || "Student"}'s submission
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Submission Content */}
              {selectedSubmission?.text_content && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Submission Text</Label>
                  <div className="p-4 bg-secondary/30 rounded-lg border max-h-60 overflow-y-auto">
                    <p className="text-sm whitespace-pre-wrap">
                      {selectedSubmission.text_content}
                    </p>
                  </div>
                </div>
              )}

              {selectedSubmission?.file_path && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Attached File</Label>
                  <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg border">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm flex-1">{selectedSubmission.file_name}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadSubmission(selectedSubmission)}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
              )}

              {selectedSubmission?.is_late && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-destructive" />
                  <span className="text-sm font-medium">This submission was late</span>
                </div>
              )}

              {/* Grading Inputs */}
              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label htmlFor="grade">
                    Grade * (0 - {assignment?.points_possible || 100})
                  </Label>
                  <Input
                    id="grade"
                    type="number"
                    min="0"
                    max={assignment?.points_possible || 100}
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    placeholder="Enter grade"
                  />
                </div>
                <div className="col-span-2 flex items-end">
                  <div className="text-sm text-muted-foreground">
                    Points possible: <span className="font-semibold">{assignment?.points_possible || 100}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="feedback">Feedback</Label>
                <Textarea
                  id="feedback"
                  rows={4}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Provide feedback to the student..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setGradeDialogOpen(false);
                  setSelectedSubmission(null);
                  setGrade("");
                  setFeedback("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleGradeSubmission}
                disabled={!grade || isSubmitting}
              >
                {isSubmitting ? "Submitting..." : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Submit Grade
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default TeacherAssignmentSubmissions;
