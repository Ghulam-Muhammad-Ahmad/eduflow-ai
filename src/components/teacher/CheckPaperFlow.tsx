import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  FileText,
  Download,
  Save,
  AlertCircle,
  Settings,
  Plus,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useRouter } from "next/router";
import { useAuth } from "@/hooks/useAuth";
import { useClassrooms } from "@/hooks/useClassrooms";
import { useClassroomStudents } from "@/hooks/useClassroomStudents";
import { useCheckerPresets } from "@/hooks/useCheckerPresets";
import { useTeacherDocuments } from "@/hooks/useTeacherDocuments";
import { toast } from "sonner";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface CheckResult {
  grade: number;
  feedback: string;
  mistakes: string[];
  gradeBreakdown?: { category: string; points: number; maxPoints: number; feedback: string }[];
  model: string;
  /** Rubric categories used for this run (for aligning breakdown display) */
  usedRubricCategories?: { name: string; max_points: number; description: string | null }[];
}

const NO_REF_DOC_VALUE = "__NO_REF_DOC__";
const ALL_STUDENTS_VALUE = "__ALL_STUDENTS__";

/** Align API gradeBreakdown with preset rubric (order and category names) for display */
function alignBreakdownWithPreset(
  gradeBreakdown: { category: string; points: number; maxPoints: number; feedback: string }[] | undefined,
  usedRubricCategories: { name: string; max_points: number; description: string | null }[] | undefined
): { category: string; points: number; maxPoints: number; feedback: string }[] {
  if (!gradeBreakdown?.length) return [];
  if (!usedRubricCategories?.length) return gradeBreakdown;
  return usedRubricCategories.map((presetCat, index) => {
    const apiRow = gradeBreakdown[index] ?? gradeBreakdown.find(
      (r) => r.category.trim().toLowerCase() === presetCat.name.trim().toLowerCase()
    );
    return {
      category: presetCat.name,
      points: apiRow?.points ?? 0,
      maxPoints: apiRow?.maxPoints ?? presetCat.max_points,
      feedback: apiRow?.feedback ?? "—",
    };
  });
}

const CheckPaperFlow = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { classrooms } = useClassrooms();
  const { data: presets } = useCheckerPresets();
  const { data: teacherDocuments } = useTeacherDocuments();

  const [inputMode, setInputMode] = useState<"upload" | "paste">("upload");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [instructions, setInstructions] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  // Change initial selectedSource to be the string value of NO_REF_DOC_VALUE for clarity
  const [selectedSource, setSelectedSource] = useState<string>(NO_REF_DOC_VALUE);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);

  // Save for student flow
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [selectedClassroom, setSelectedClassroom] = useState("");
  // Default this as ALL_STUDENTS_VALUE (not an empty string!)
  const [selectedStudent, setSelectedStudent] = useState<string>(ALL_STUDENTS_VALUE);
  const [saveLoading, setSaveLoading] = useState(false);

  const { data: students } = useClassroomStudents(selectedClassroom);
  const selectedClassroomData = classrooms?.find((c) => c.id === selectedClassroom);
  const currentPreset =
    selectedPreset && selectedPreset !== "custom"
      ? presets?.find((p) => p.id === selectedPreset)
      : undefined;
  // Effective reference: from preset or run-time selection (Document Center)
  const effectiveReferenceDocumentId =
    currentPreset?.reference_document_id ?? (selectedSource !== NO_REF_DOC_VALUE ? selectedSource : undefined);
  const currentSource = effectiveReferenceDocumentId
    ? teacherDocuments?.find((d) => d.id === effectiveReferenceDocumentId)
    : undefined;
  const showRunTimeSource = !currentPreset?.reference_document_id;
  const showRunTimeInstructions = !currentPreset?.instructions?.trim();
  const effectiveInstructionsForDisplay =
    (currentPreset?.instructions?.trim() || instructions.trim()) || "General paper check";

  /**
   * Handles file uploads. Accepts PDF files only.
   */
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setPdfFile(file);
    } else {
      toast.error("Please select a PDF file");
    }
  };

  /**
   * Converts a PDF file to Base64 string.
   */
  const convertPdfToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  /**
   * Handles submission to the /api/ai/check-paper endpoint.
   * Handles both PDF upload and pasted text,
   * and supports presets and source documents if selected.
   */
  const handleCheckPaper = async () => {
    if (!user) {
      toast.error("User not authenticated");
      return;
    }
    if (inputMode === "upload" && !pdfFile) {
      toast.error("Please select a PDF file");
      return;
    }
    if (inputMode === "paste" && !pastedText.trim()) {
      toast.error("Please paste some text");
      return;
    }

    setLoading(true);
    try {
      const effectiveInstructions = (currentPreset?.instructions?.trim() || instructions.trim()) || "";
      const payload: Record<string, unknown> = {
        userId: user.id,
        instructions: effectiveInstructions,
        rubricCategories: currentPreset?.rubric_categories,
        sourceDocumentId: effectiveReferenceDocumentId,
      };
      if (inputMode === "upload" && pdfFile) {
        payload.pdfBase64 = await convertPdfToBase64(pdfFile);
      } else {
        payload.pastedText = pastedText.trim();
      }

      const response = await fetch("/api/ai/check-paper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to check paper");
      }

      setResult({
        grade: data.grade,
        feedback: data.feedback,
        mistakes: data.mistakes || [],
        gradeBreakdown: data.gradeBreakdown,
        model: data.model,
        usedRubricCategories: currentPreset?.rubric_categories,
      });
      toast.success("Paper checked successfully");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to check paper");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Download the result as a formatted text file.
   */
  const handleDownload = () => {
    if (!result) return;

    const contentParts: string[] = [
      "AI Paper Check Result",
      "=====================",
      "",
      `Grade: ${result.grade}/100`,
      `Model: ${result.model}`,
      "",
      `Instructions: ${effectiveInstructionsForDisplay}`,
      "",
      currentPreset ? `Using Preset: ${currentPreset.name}` : "",
      "",
      "Grade Breakdown:",
      result.gradeBreakdown && result.gradeBreakdown.length > 0
        ? result.gradeBreakdown
            .map(
              (cat) =>
                `${cat.category}: ${cat.points}/${cat.maxPoints} (${Math.round(
                  (cat.points / cat.maxPoints) * 100
                )}%)`
            )
            .join("\n")
        : "No detailed breakdown provided",
      "",
      "Feedback:",
      result.feedback,
      "",
      "Mistakes Found:",
      result.mistakes.length > 0
        ? result.mistakes.map((m) => `- ${m}`).join("\n")
        : "No specific mistakes identified.",
      "",
      "Original Content:",
      inputMode === "paste" ? pastedText : "[PDF file uploaded]",
    ];

    const content = contentParts.join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `checked-paper-${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /**
   * Save result for a student/classroom.
   * Uploads an HTML file to the "documents" bucket,
   * adds a row in "documents", and in "checked_papers".
   */
  const handleSaveForStudent = async () => {
    if (!user || !result || !selectedClassroom) {
      toast.error("Missing required information");
      return;
    }

    setSaveLoading(true);
    try {
      // Generate HTML with optional breakdown (aligned with preset when available)
      const savedBreakdownRows = alignBreakdownWithPreset(
        result.gradeBreakdown,
        result.usedRubricCategories
      );
      const gradeBreakdownHtml = savedBreakdownRows.length > 0
        ? `<div style="margin-top: 10px;">
            <h3>Grade Breakdown</h3>
            ${savedBreakdownRows
              .map(
                (cat) =>
                  `<div style="margin-bottom:5px;">
                    <strong>${cat.category}:</strong> ${cat.points}/${cat.maxPoints} (${cat.maxPoints > 0 ? Math.round(
                    (cat.points / cat.maxPoints) * 100
                  ) : 0}%)
                    ${cat.feedback && cat.feedback !== "—" ? `<br /><em>${cat.feedback}</em>` : ""}
                  </div>`
              )
              .join("")}
          </div>`
        : "";

      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Checked Paper - Grade: ${result.grade}/100</title>
  <style>
    @font-face { font-family: "SF Pro Display"; src: url("/fonts/SFPRODISPLAYREGULAR.OTF") format("opentype"); font-weight: 400; font-style: normal; }
    @font-face { font-family: "SF Pro Display"; src: url("/fonts/SFPRODISPLAYMEDIUM.OTF") format("opentype"); font-weight: 500; font-style: normal; }
    @font-face { font-family: "SF Pro Display"; src: url("/fonts/SFPRODISPLAYBOLD.OTF") format("opentype"); font-weight: 700; font-style: normal; }
    body { font-family: "SF Pro Display", system-ui, sans-serif; margin: 40px; line-height: 1.6; }
    .header { border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; margin-bottom: 30px; }
    .grade { font-size: 24px; font-weight: bold; color: #059669; }
    .feedback { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .mistakes { background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .mistake-item { margin: 8px 0; }
    .original { background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; white-space: pre-wrap; }
    .breakdown { background: #eefafd; padding: 18px; border-radius: 8px; margin-bottom: 20px;}
  </style>
</head>
<body>
  <div class="header">
      <h1>AI Checked Paper</h1>
      <p><strong>Grade:</strong> <span class="grade">${result.grade}/100</span></p>
      <p><strong>Checked on:</strong> ${new Date().toLocaleDateString()}</p>
      <p><strong>Instructions:</strong> ${effectiveInstructionsForDisplay}</p>
      <p><strong>Model:</strong> ${result.model}</p>
      ${currentPreset ? `<p><strong>Preset:</strong> ${currentPreset.name}</p>` : ""}
      ${currentSource ? `<p><strong>Reference:</strong> ${currentSource.name}</p>` : ""}
  </div>

  ${
    gradeBreakdownHtml
      ? `<div class="breakdown">${gradeBreakdownHtml}</div>`
      : ""
  }

  <div class="feedback">
      <h2>Feedback</h2>
      <p>${result.feedback}</p>
  </div>

  <div class="mistakes">
      <h2>Mistakes Found</h2>
      ${
        result.mistakes.length > 0
          ? result.mistakes
              .map((m) => `<div class="mistake-item">• ${m}</div>`)
              .join("")
          : "<p>No specific mistakes identified.</p>"
      }
  </div>

  <div class="original">
      <h2>Original Content</h2>
      ${
        inputMode === "paste"
          ? pastedText.replace(/\n/g, "<br>")
          : "<p>[PDF file was uploaded and processed]</p>"
      }
  </div>
</body>
</html>
      `;

      // Upload to Supabase Storage Documents bucket
      const fileName = `checked-paper-${Date.now()}.html`;
      const filePath = `checked-papers/${fileName}`;
      const uploadBlob = new Blob([htmlContent], { type: "text/html" });

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, uploadBlob, { contentType: "text/html" });

      if (uploadError) throw uploadError;

      // Insert row into documents table
      const { error: docError } = await supabase.from("documents").insert({
        name: `Checked Paper - Grade ${result.grade}`,
        file_path: filePath,
        file_type: "text/html",
        file_size: uploadBlob.size,
        user_id: user.id,
      });

      if (docError) throw docError;

      // Insert row into checked_papers for classroom access
      const { error: dbError } = await supabase.from("checked_papers").insert({
        teacher_id: user.id,
        classroom_id: selectedClassroom,
        student_id:
          selectedStudent && selectedStudent !== ALL_STUDENTS_VALUE
            ? selectedStudent
            : null,
        title: `Paper - Grade ${result.grade}/100`,
        file_path: filePath,
        grade: result.grade,
        feedback_text: result.feedback,
        instructions_used: effectiveInstructionsForDisplay !== "General paper check" ? effectiveInstructionsForDisplay : null,
      });

      if (dbError) throw dbError;

      toast.success("Paper saved for student successfully");
      setSaveDialogOpen(false);
      setSelectedClassroom("");
      setSelectedStudent(ALL_STUDENTS_VALUE);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to save paper");
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Presets Section */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Checker Configuration</h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <Label>Use Preset (optional)</Label>
            <div className="flex gap-2">
              <Select value={selectedPreset} onValueChange={setSelectedPreset}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a preset or use custom" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom grading</SelectItem>
                  {presets?.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.name} ({preset.total_points} pts)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/dashboard/teacher/checker/presets")}
              >
                <Plus className="h-4 w-4 mr-2" />
                Manage
              </Button>
            </div>
            {currentPreset && (
              <div className="text-sm text-muted-foreground">
                <strong>Selected:</strong> {currentPreset.name}
                <div className="mt-1">
                  {currentPreset.rubric_categories.map((cat, i) => (
                    <div key={i}>
                      • {cat.name}: {cat.max_points} pts
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Source Document: only when preset does not define one */}
      {showRunTimeSource && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5" />
            <h3 className="text-lg font-semibold">Source Document (optional)</h3>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <Label>Reference Document</Label>
              <div className="flex gap-2">
                <Select
                  value={selectedSource ?? NO_REF_DOC_VALUE}
                  onValueChange={(val) => setSelectedSource(val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a reference document" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_REF_DOC_VALUE}>
                      No reference document
                    </SelectItem>
                    {teacherDocuments?.map((doc) => (
                      <SelectItem key={doc.id} value={doc.id}>
                        {doc.name}
                        {doc.file_type ? ` (${doc.file_type})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/dashboard/teacher/documents")}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Manage Sources
                </Button>
              </div>
            </div>
            {currentSource && (
              <div className="text-sm text-muted-foreground">
                <strong>Selected:</strong> {currentSource.name}
                {currentSource.file_type && (
                  <div className="mt-1">Type: {currentSource.file_type}</div>
                )}
              </div>
            )}
          </div>
        </Card>
      )}
      {!showRunTimeSource && currentSource && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5" />
            <h3 className="text-lg font-semibold">Source Document</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Using reference from preset: <strong>{currentSource.name}</strong>
          </p>
        </Card>
      )}

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Check Paper</h2>

        <Tabs
          value={inputMode}
          onValueChange={(v) => setInputMode(v as "upload" | "paste")}
        >
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload PDF
            </TabsTrigger>
            <TabsTrigger value="paste" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Paste Text
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4 mt-6">
            <div>
              <Label>Upload PDF</Label>
              <div className="mt-2">
                <Input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="cursor-pointer"
                />
              </div>
              {pdfFile && (
                <p className="text-sm text-muted-foreground mt-2">
                  Selected: {pdfFile.name} (
                  {(pdfFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="paste" className="space-y-4 mt-6">
            <div>
              <Label>Paste your text</Label>
              <Textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Paste your essay or paper text here..."
                rows={12}
                className="mt-2"
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-6 space-y-4">
          {showRunTimeInstructions && (
            <>
              <Label>Instructions (optional)</Label>
              <Textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Additional instructions for the AI checker..."
                rows={3}
              />
            </>
          )}
          {!showRunTimeInstructions && currentPreset?.instructions?.trim() && (
            <p className="text-sm text-muted-foreground">
              Using instructions from preset: <strong>{currentPreset.name}</strong>
            </p>
          )}
          <Button onClick={handleCheckPaper} disabled={loading} size="lg">
            {loading ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Checking...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Check Paper
              </>
            )}
          </Button>
        </div>
      </Card>

      {result && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Check Result</h3>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Model: {result.model}</Badge>
              <Badge className="text-lg px-3 py-1">
                Grade: {result.grade}/100
              </Badge>
            </div>
          </div>

          {/* Grade Breakdown (aligned with preset rubric when available) */}
          {(() => {
            const breakdownRows = alignBreakdownWithPreset(
              result.gradeBreakdown,
              result.usedRubricCategories
            );
            if (breakdownRows.length === 0) return null;
            return (
              <div className="mb-6">
                <h4 className="font-medium mb-3">Grade Breakdown</h4>
                <div className="space-y-2">
                  {breakdownRows.map((category, index) => (
                    <div key={index} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{category.category}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {category.points}/{category.maxPoints}
                          </span>
                          <Badge variant="outline">
                            {category.maxPoints > 0
                              ? Math.round(
                                  (category.points / category.maxPoints) * 100
                                )
                              : 0}
                            %
                          </Badge>
                        </div>
                      </div>
                      <Progress
                        value={
                          category.maxPoints > 0
                            ? (category.points / category.maxPoints) * 100
                            : 0
                        }
                        className="mb-2"
                      />
                      {category.feedback && category.feedback !== "—" && (
                        <p className="text-sm text-muted-foreground">
                          {category.feedback}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Feedback</h4>
              <div className="bg-muted p-4 rounded-lg">
                <p className="whitespace-pre-wrap">{result.feedback}</p>
              </div>
            </div>

            {result.mistakes.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Mistakes Found</h4>
                <div className="bg-red-50 p-4 rounded-lg">
                  <ul className="space-y-1">
                    {result.mistakes.map((mistake, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-2"
                      >
                        <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                        <span>{mistake}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button onClick={handleDownload} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download Result
              </Button>
              <Button onClick={() => setSaveDialogOpen(true)}>
                <Save className="h-4 w-4 mr-2" />
                Save for Student
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Save Paper for Student</DialogTitle>
            <DialogDescription>
              Choose a classroom and optionally a student to save this checked
              paper.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Classroom</Label>
              <Select
                value={selectedClassroom}
                onValueChange={setSelectedClassroom}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select classroom" />
                </SelectTrigger>
                <SelectContent>
                  {classrooms?.map((classroom) => (
                    <SelectItem key={classroom.id} value={classroom.id}>
                      {classroom.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedClassroomData && (
              <div>
                <Label>Student (optional)</Label>
                <Select
                  value={selectedStudent ?? ALL_STUDENTS_VALUE}
                  onValueChange={setSelectedStudent}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All students in classroom" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_STUDENTS_VALUE}>
                      All students in classroom
                    </SelectItem>
                    {students?.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setSaveDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveForStudent}
                disabled={!selectedClassroom || saveLoading}
              >
                {saveLoading ? (
                  <Spinner size="sm" />
                ) : (
                  "Save Paper"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CheckPaperFlow;
