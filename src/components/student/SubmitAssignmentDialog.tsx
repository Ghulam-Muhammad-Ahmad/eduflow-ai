import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useStudentSubmissions, useSubmission } from "@/hooks/useSubmissions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { FileText, Upload, File, X, Clock, CheckCircle } from "lucide-react";
import { format } from "date-fns";

interface SubmitAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: {
    id: string;
    title: string;
    description?: string | null;
    instructions?: string | null;
    due_date?: string | null;
    points_possible?: number | null;
    classrooms?: { name: string } | null;
  };
}

const SubmitAssignmentDialog = ({
  open,
  onOpenChange,
  assignment,
}: SubmitAssignmentDialogProps) => {
  const [textContent, setTextContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<"text" | "file">("text");

  const { submitAssignment, submitWithFile } = useStudentSubmissions();
  const { data: existingSubmission, isLoading: loadingSubmission } = useSubmission(assignment.id);

  const isLate = assignment.due_date
    ? new Date() > new Date(assignment.due_date)
    : false;

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB limit
    accept: {
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "image/*": [".png", ".jpg", ".jpeg", ".gif"],
      "text/plain": [".txt"],
    },
  });

  const handleSubmit = async () => {
    if (activeTab === "text" && textContent.trim()) {
      await submitAssignment.mutateAsync({
        assignmentId: assignment.id,
        textContent: textContent.trim(),
        isLate,
      });
      setTextContent("");
      onOpenChange(false);
    } else if (activeTab === "file" && selectedFile) {
      await submitWithFile.mutateAsync({
        assignmentId: assignment.id,
        file: selectedFile,
        isLate,
      });
      setSelectedFile(null);
      onOpenChange(false);
    }
  };

  const isPending = submitAssignment.isPending || submitWithFile.isPending;
  const canSubmit =
    (activeTab === "text" && textContent.trim()) ||
    (activeTab === "file" && selectedFile);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Submit: {assignment.title}
            {isLate && (
              <Badge variant="destructive" className="text-xs">
                Late
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {assignment.classrooms?.name}
            {assignment.due_date && (
              <span className="ml-2">
                • Due: {format(new Date(assignment.due_date), "MMM d, yyyy h:mm a")}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Assignment Details */}
        {(assignment.description || assignment.instructions) && (
          <div className="space-y-3 py-2 border-b">
            {assignment.description && (
              <p className="text-sm text-muted-foreground">{assignment.description}</p>
            )}
            {assignment.instructions && (
              <div className="bg-secondary/50 p-3 rounded-lg">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Instructions
                </p>
                <p className="text-sm whitespace-pre-wrap">{assignment.instructions}</p>
              </div>
            )}
          </div>
        )}

        {/* Existing Submission Status */}
        {existingSubmission && (
          <div className="flex items-center gap-2 p-3 bg-accent/20 rounded-lg">
            <CheckCircle className="w-4 h-4 text-accent" />
            <div className="flex-1">
              <p className="text-sm font-medium">Previously submitted</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(existingSubmission.submitted_at), "MMM d, yyyy h:mm a")}
                {existingSubmission.grade !== null && (
                  <span className="ml-2">
                    • Grade: {existingSubmission.grade}/{assignment.points_possible}
                  </span>
                )}
              </p>
            </div>
            <Badge variant="secondary" className="text-xs">
              {existingSubmission.status}
            </Badge>
          </div>
        )}

        {/* Submission Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "text" | "file")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="text" className="gap-2">
              <FileText className="w-4 h-4" />
              Text Response
            </TabsTrigger>
            <TabsTrigger value="file" className="gap-2">
              <Upload className="w-4 h-4" />
              Upload File
            </TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="space-y-4">
            <Textarea
              placeholder="Type your response here..."
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              rows={10}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {textContent.length} characters
            </p>
          </TabsContent>

          <TabsContent value="file" className="space-y-4">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                isDragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50"
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              {isDragActive ? (
                <p className="text-sm">Drop the file here...</p>
              ) : (
                <>
                  <p className="text-sm font-medium">
                    Drag & drop a file here, or click to select
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, DOC, DOCX, images, or TXT (max 10MB)
                  </p>
                </>
              )}
            </div>

            {selectedFile && (
              <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                <File className="w-8 h-8 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedFile(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2">
          {isLate && (
            <div className="flex items-center gap-1 text-xs text-destructive mr-auto">
              <Clock className="w-3 h-3" />
              This submission will be marked as late
            </div>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isPending}>
            {isPending
              ? "Submitting..."
              : existingSubmission
              ? "Resubmit"
              : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SubmitAssignmentDialog;
