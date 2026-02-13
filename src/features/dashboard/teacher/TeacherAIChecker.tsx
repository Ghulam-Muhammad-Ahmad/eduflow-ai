import { useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, FileText, Loader2, CheckCircle, XCircle, Users } from "lucide-react";
import { useAIChecker, AIFeedback } from "@/hooks/useAIChecker";
import { useAssignments, useAssignmentSubmissions } from "@/hooks/useAssignments";
import { useAuth } from "@/hooks/useAuth";
import { useAIUsage } from "@/hooks/useAIUsage";
import { format } from "date-fns";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import CheckPaperFlow from "@/components/teacher/CheckPaperFlow";

type FlowMode = "assignment" | "paper";

const TeacherAIChecker = () => {
  const queryClient = useQueryClient();
  useAuth();
  const { usage, isNearLimit } = useAIUsage();
  const {
    gradeSubmissionWithAI,
    gradeBatchSubmissions,
    fetchAIFeedback,
    applyGradeAndFeedback,
    loading,
  } = useAIChecker();
  const { assignments } = useAssignments();

  const [flowMode, setFlowMode] = useState<FlowMode>("assignment");
  const [selectedAssignment, setSelectedAssignment] = useState<string>("");
  const {
    data: submissions,
    isLoading: submissionsLoading,
    refetch: refetchSubmissions,
  } = useAssignmentSubmissions(selectedAssignment || null);
  const [selectedSubmission, setSelectedSubmission] = useState<{ id: string; assignment_id: string; file_path?: string; text_content?: string } | null>(null);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [aiFeedback, setAIFeedback] = useState<AIFeedback | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [suggestedGrade, setSuggestedGrade] = useState<string>("");
  const [applyLoading, setApplyLoading] = useState(false);

  const assignment = assignments?.find((a) => a.id === selectedAssignment);
  const pointsPossible = assignment?.points_possible ?? 100;

  const handleGradeSubmission = async (submission: { id: string; assignment_id: string; file_path?: string; text_content?: string }) => {
    if (!submission) return;

    const assign = assignments?.find((a) => a.id === submission.assignment_id);
    if (!assign) return;

    if (submission.file_path && !submission.text_content?.trim()) {
      toast.info("File submission detected. Please extract text before grading with AI.");
      return;
    }

    const submissionText = submission.text_content || "";

    try {
      const result = await gradeSubmissionWithAI(
        submission.id,
        submissionText,
        assign.description || assign.title,
        undefined,
        assign.points_possible ?? 100
      );

      if (result?.success) {
        setSelectedSubmission(submission);
        setFeedbackDialogOpen(true);

        const feedback = await fetchAIFeedback(submission.id);
        if (feedback) {
          setAIFeedback(feedback);
          const grade =
            feedback.feedback_data.suggested_grade ?? result.suggested_grade;
          setSuggestedGrade(
            typeof grade === "number" ? String(grade) : ""
          );
          setFeedbackText(
            result.feedback ??
              feedback.feedback_data.overall_feedback ??
              ""
          );
        } else {
          setSuggestedGrade(
            typeof result.suggested_grade === "number"
              ? String(result.suggested_grade)
              : ""
          );
          setFeedbackText(result.feedback ?? result.content ?? "");
        }
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to grade submission");
    }
  };

  const handleBatchGrade = async () => {
    if (!selectedAssignment || !submissions || submissions.length === 0) return;

    const assign = assignments?.find((a) => a.id === selectedAssignment);
    if (!assign) return;

    const ungradedSubmissions = submissions.filter(
      (s: { status?: string; grade?: number | null }) => s.status === "submitted" && !s.grade
    );

    if (ungradedSubmissions.length === 0) {
      toast.info("No ungraded submissions to process");
      return;
    }

    const batchData = ungradedSubmissions.map((s) => {
      const sub = s as { id: string; text_content?: string | null; file_path?: string | null };
      return {
        id: sub.id,
        text: sub.text_content ?? "",
        assignmentDescription: assign.description || assign.title,
        hasFile: !!sub.file_path,
      };
    });

    try {
      const results = await gradeBatchSubmissions(batchData);
      toast.success(`Checked ${results.length} submissions`);
      await refetchSubmissions();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to check submissions"
      );
    }
  };

  const handleAcceptAndApply = async () => {
    if (!aiFeedback || !selectedSubmission) return;

    const gradeValue = parseFloat(suggestedGrade);
    if (isNaN(gradeValue) || gradeValue < 0 || gradeValue > pointsPossible) {
      toast.error(`Grade must be between 0 and ${pointsPossible}`);
      return;
    }

    setApplyLoading(true);
    try {
      const success = await applyGradeAndFeedback(
        selectedSubmission.id,
        gradeValue,
        feedbackText,
        aiFeedback.id,
        { pointsPossible }
      );
      if (success) {
        setFeedbackDialogOpen(false);
        setSelectedSubmission(null);
        setAIFeedback(null);
        queryClient.invalidateQueries({
          queryKey: ["assignment-submissions", selectedAssignment],
        });
        refetchSubmissions();
      }
    } finally {
      setApplyLoading(false);
    }
  };

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">AI Checker</h1>
            <p className="text-muted-foreground mt-1">
              Check assignments with suggested grades, or check any paper (PDF/paste) and save for students
            </p>
          </div>
          {usage && isNearLimit() && (
            <Badge variant="destructive">
              {usage.remaining} AI requests remaining
            </Badge>
          )}
        </div>

        <Tabs value={flowMode} onValueChange={(v) => setFlowMode(v as FlowMode)}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="assignment" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Check Assignment
            </TabsTrigger>
            <TabsTrigger value="paper" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Check Paper
            </TabsTrigger>
          </TabsList>

          <TabsContent value="assignment" className="space-y-6 mt-6">
            <Card className="p-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label>Select Assignment</Label>
                  <Select
                    value={selectedAssignment}
                    onValueChange={setSelectedAssignment}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an assignment" />
                    </SelectTrigger>
                    <SelectContent>
                      {assignments?.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.title}
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
                        Check All Ungraded
                      </>
                    )}
                  </Button>
                )}
              </div>
            </Card>

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
                        <TableCell
                          colSpan={5}
                          className="text-center py-8 text-muted-foreground"
                        >
                          Loading submissions...
                        </TableCell>
                      </TableRow>
                    ) : !submissions || submissions.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No submissions yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      submissions.map((submission) => {
                        const sub = submission as { id: string; assignment_id?: string; profiles?: { display_name?: string }; submitted_at?: string; status?: string; grade?: number | null };
                        return (
                        <TableRow key={submission.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <span>
                                {sub.profiles?.display_name ??
                                  (sub.profiles ? "Student" : "Unknown")}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {sub.submitted_at
                              ? format(
                                  new Date(sub.submitted_at),
                                  "MMM d, yyyy"
                                )
                              : "Not submitted"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                sub.status === "graded"
                                  ? "default"
                                  : sub.status === "submitted"
                                  ? "secondary"
                                  : "outline"
                              }
                            >
                              {sub.status ?? "—"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {sub.grade !== null &&
                            sub.grade !== undefined ? (
                              <span className="font-semibold">
                                {sub.grade}
                                {pointsPossible !== 100
                                  ? ` / ${pointsPossible}`
                                  : "%"}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleGradeSubmission({ id: sub.id, assignment_id: sub.assignment_id ?? "", file_path: (submission as { file_path?: string | null }).file_path ?? undefined, text_content: (submission as { text_content?: string | null }).text_content ?? undefined })}
                              disabled={
                                loading || sub.status !== "submitted"
                              }
                            >
                              <Brain className="h-4 w-4 mr-2" />
                              AI Check
                            </Button>
                          </TableCell>
                        </TableRow>
                      ); })
                    )}
                  </TableBody>
                </Table>
              </Card>
            )}

            {selectedAssignment && !submissions?.length && !submissionsLoading && (
              <Card className="p-12 text-center">
                <Brain className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No submissions yet</h3>
                <p className="text-muted-foreground">
                  Submissions will appear here when students submit.
                </p>
              </Card>
            )}

            {!selectedAssignment && (
              <Card className="p-12 text-center">
                <Brain className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  Select an Assignment
                </h3>
                <p className="text-muted-foreground">
                  Choose an assignment above to see submissions and run AI Check
                </p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="paper" className="mt-6">
            <CheckPaperFlow />
          </TabsContent>
        </Tabs>

        <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>AI Checker Feedback</DialogTitle>
              <DialogDescription>
                Review suggested grade and feedback, then Accept & Apply to save
                to the submission.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Suggested grade (0 – {pointsPossible})</Label>
                  <Input
                    type="number"
                    min={0}
                    max={pointsPossible}
                    value={suggestedGrade}
                    onChange={(e) => setSuggestedGrade(e.target.value)}
                    placeholder="Grade"
                  />
                </div>
              </div>
              <div>
                <Label>Feedback</Label>
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
                      <span>Accept & Apply to set grade and feedback on submission</span>
                    </>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setFeedbackDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAcceptAndApply}
                  disabled={
                    applyLoading ||
                    !suggestedGrade.trim() ||
                    isNaN(parseFloat(suggestedGrade))
                  }
                >
                  {applyLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Accept & Apply"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default TeacherAIChecker;
