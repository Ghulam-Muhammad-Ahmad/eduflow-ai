import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Brain, Upload, CheckCircle, XCircle, Loader2, FileText, Users } from "lucide-react";
import { useAIGrading, AIFeedback } from "@/hooks/useAIGrading";
import { useAssignments, useAssignmentSubmissions } from "@/hooks/useAssignments";
import { useAuth } from "@/hooks/useAuth";
import { useAIUsage } from "@/hooks/useAIUsage";
import { format } from "date-fns";

const TeacherAIGrading = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { usage, isNearLimit } = useAIUsage();
  const { gradeSubmissionWithAI, gradeBatchSubmissions, fetchAIFeedback, acceptAIFeedback, loading } = useAIGrading();
  const { assignments } = useAssignments();
  
  const [selectedAssignment, setSelectedAssignment] = useState<string>("");
  const { data: submissions, isLoading: submissionsLoading } = useAssignmentSubmissions(selectedAssignment || null);
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [aiFeedback, setAIFeedback] = useState<AIFeedback | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [gradingResult, setGradingResult] = useState<string>("");

  const handleGradeSubmission = async (submission: any) => {
    if (!submission) return;

    // Get assignment details
    const assignment = assignments?.find((a) => a.id === submission.assignment_id);
    if (!assignment) return;

    // Get submission text (from file or text_content)
    let submissionText = submission.text_content || "";
    
    // If file submission, we'd need to extract text (simplified for now)
    if (submission.file_path && !submissionText) {
      submissionText = "[File submission - text extraction needed]";
    }

    const result = await gradeSubmissionWithAI(
      submission.id,
      submissionText,
      assignment.description || assignment.title,
      undefined // rubric can be added later
    );

    if (result?.success) {
      setGradingResult(result.content);
      setSelectedSubmission(submission);
      setFeedbackDialogOpen(true);
      
      // Load saved feedback
      const feedback = await fetchAIFeedback(submission.id);
      if (feedback) {
        setAIFeedback(feedback);
        setFeedbackText(feedback.feedback_data.overall_feedback || result.content);
      } else {
        setFeedbackText(result.content);
      }
    }
  };

  const handleBatchGrade = async () => {
    if (!selectedAssignment || !submissions || submissions.length === 0) return;

    const assignment = assignments?.find((a) => a.id === selectedAssignment);
    if (!assignment) return;

    const ungradedSubmissions = submissions.filter(
      (s: any) => s.status === 'submitted' && !s.grade
    );

    if (ungradedSubmissions.length === 0) {
      alert("No ungraded submissions to process");
      return;
    }

    const batchData = ungradedSubmissions.map((s: any) => ({
      id: s.id,
      text: s.text_content || "[File submission]",
      assignmentDescription: assignment.description || assignment.title,
    }));

    await gradeBatchSubmissions(batchData);
  };

  const handleAcceptFeedback = async () => {
    if (!aiFeedback) return;

    const success = await acceptAIFeedback(aiFeedback.id, feedbackText);
    if (success) {
      setFeedbackDialogOpen(false);
    }
  };

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">AI Paper Checker</h1>
            <p className="text-muted-foreground mt-1">
              Get AI-powered grading assistance and feedback suggestions
            </p>
          </div>
          {isNearLimit() && (
            <Badge variant="destructive">
              {usage?.remaining} AI requests remaining
            </Badge>
          )}
        </div>

        {/* Assignment Selector */}
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label>Select Assignment</Label>
              <Select value={selectedAssignment} onValueChange={setSelectedAssignment}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an assignment" />
                </SelectTrigger>
                <SelectContent>
                  {assignments?.map((assignment) => (
                    <SelectItem key={assignment.id} value={assignment.id}>
                      {assignment.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedAssignment && (
              <Button
                onClick={handleBatchGrade}
                disabled={loading}
                variant="outline"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4 mr-2" />
                    Grade All Ungraded
                  </>
                )}
              </Button>
            )}
          </div>
        </Card>

        {/* Submissions Table */}
        {selectedAssignment && (
          <Card>
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
                {submissionsLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Loading submissions...
                    </TableCell>
                  </TableRow>
                ) : !submissions || submissions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No submissions yet
                    </TableCell>
                  </TableRow>
                ) : (
                  submissions.map((submission: any) => (
                    <TableRow key={submission.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {submission.profiles?.display_name || 
                             (submission.profiles ? 'Student' : 'Unknown')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {submission.submitted_at
                          ? format(new Date(submission.submitted_at), "MMM d, yyyy")
                          : "Not submitted"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            submission.status === "graded"
                              ? "live"
                              : submission.status === "submitted"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {submission.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {submission.grade !== null ? (
                          <span className="font-semibold">{submission.grade}%</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleGradeSubmission(submission)}
                          disabled={loading || submission.status !== "submitted"}
                        >
                          <Brain className="h-4 w-4 mr-2" />
                          AI Grade
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        )}

        {!selectedAssignment && (
          <Card className="p-12 text-center">
            <Brain className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Select an Assignment</h3>
            <p className="text-muted-foreground">
              Choose an assignment above to start using AI grading assistance
            </p>
          </Card>
        )}

        {/* Feedback Dialog */}
        <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>AI Grading Feedback</DialogTitle>
              <DialogDescription>
                Review and modify AI-generated feedback for this submission
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              <div>
                <Label>AI Feedback</Label>
                <Textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>

              {aiFeedback && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {aiFeedback.accepted ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Feedback accepted</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-orange-500" />
                      <span>Review and accept to apply</span>
                    </>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setFeedbackDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAcceptFeedback}>
                  Accept & Apply Feedback
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default TeacherAIGrading;
