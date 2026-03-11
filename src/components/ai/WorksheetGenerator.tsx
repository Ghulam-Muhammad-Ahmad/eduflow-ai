import { useState } from "react";
import { useRouter } from "next/router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAIStudio } from "@/hooks/useAIStudio";
import { AI_SOURCE_TEXT_MAX_CHARS } from "@/services/aiService";
import { WORKSHEET_SYSTEM_TEMPLATES, type WorksheetContent } from "@/types/worksheet";
import { DocCenterMini, type DocCenterSelection } from "@/components/ai/DocCenterMini";
import { FileSpreadsheet, FolderOpen, X, AlertTriangle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { WorksheetTemplateLayout } from "@/components/ai/WorksheetTemplateLayout";
import { WorksheetContentRender } from "@/components/ai/WorksheetContentRender";

const OTHER_OPTION_VALUE = "__other__";

const DIFFICULTY_OPTIONS = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

const GRADE_OPTIONS = [
  { value: "Elementary (K-5)", label: "Elementary (K-5)" },
  { value: "Middle School (6-8)", label: "Middle School (6-8)" },
  { value: "High School (9-12)", label: "High School (9-12)" },
  { value: "College", label: "College" },
];

interface WorksheetGeneratorProps {
  onContentGenerated?: () => void;
}

const WORKSHEET_DOC_FORMATS = ["pdf", "txt", "doc", "docx"];

const WorksheetGenerator = ({ onContentGenerated }: WorksheetGeneratorProps) => {
  const router = useRouter();
  const { createWorksheet, loading } = useAIStudio();
  const { toast } = useToast();

  const [inputMode, setInputMode] = useState<"topic" | "document">("topic");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    WORKSHEET_SYSTEM_TEMPLATES[0]?.id ?? "classic"
  );
  const [topic, setTopic] = useState("");
  const [sourceMaterial, setSourceMaterial] = useState<string | null>(null);
  const [sourcePdfBase64, setSourcePdfBase64] = useState<string | null>(null);
  const [sourcePdfFileName, setSourcePdfFileName] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [docCenterOpen, setDocCenterOpen] = useState(false);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [grade, setGrade] = useState("");
  const [gradeCustom, setGradeCustom] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [difficultyCustom, setDifficultyCustom] = useState("");
  const [instructions, setInstructions] = useState("");
  const [questionCount, setQuestionCount] = useState<string>("10");

  const extFromName = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

  const handleDocCenterSelect = async (selection: DocCenterSelection) => {
    if (selection.type === "file") {
      const ext = extFromName(selection.file.name);
      if (!WORKSHEET_DOC_FORMATS.includes(ext)) {
        toast({
          title: "Invalid file",
          description: `Worksheet Maker allows: ${WORKSHEET_DOC_FORMATS.map((f) => f.toUpperCase()).join(", ")}.`,
          variant: "destructive",
        });
        return;
      }
      setLoadingDoc(true);
      try {
        const bytes = await selection.file.arrayBuffer();
        const arr = new Uint8Array(bytes);
        let binary = "";
        const chunk = 8192;
        for (let i = 0; i < arr.length; i += chunk) {
          binary += String.fromCharCode(...arr.subarray(i, i + chunk));
        }
        const base64 = btoa(binary);
        if (ext === "pdf") {
          setSourcePdfBase64(base64);
          setSourcePdfFileName(selection.file.name);
          setSourceMaterial(null);
          setSourceName(selection.file.name);
          setDocCenterOpen(false);
          toast({ title: "Document ready", description: `Using PDF as-is: "${selection.file.name}"` });
        } else {
          const res = await fetch("/api/documents/extract-file", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ base64, fileName: selection.file.name }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Extraction failed");
          setSourceMaterial(data.text?.trim() ?? "");
          setSourcePdfBase64(null);
          setSourcePdfFileName(null);
          setSourceName(data.name ?? selection.file.name);
          setDocCenterOpen(false);
          toast({ title: "Document ready", description: `Using "${data.name ?? selection.file.name}"` });
        }
      } catch (e) {
        toast({
          title: "Could not process file",
          description: e instanceof Error ? e.message : "Try a different file.",
          variant: "destructive",
        });
      } finally {
        setLoadingDoc(false);
      }
      return;
    }
    const doc = selection.doc;
    const ext = extFromName(doc.name);
    if (!WORKSHEET_DOC_FORMATS.includes(ext)) {
      toast({
        title: "Invalid document",
        description: `Worksheet Maker allows: ${WORKSHEET_DOC_FORMATS.map((f) => f.toUpperCase()).join(", ")}.`,
        variant: "destructive",
      });
      return;
    }
    setLoadingDoc(true);
    try {
      const res = await fetch("/api/documents/extract-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: doc.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Extraction failed");
      setSourceMaterial(data.text?.trim() ?? "");
      setSourceName(data.name ?? doc.name);
      setDocCenterOpen(false);
      toast({ title: "Document ready", description: `Using "${data.name ?? doc.name}"` });
    } catch (e) {
      toast({
        title: "Could not load document",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingDoc(false);
    }
  };

  const parsedQuestionCount = Number(questionCount) || 3;
  const previewWorksheet: WorksheetContent = {
    title: topic.trim() || "Sample worksheet title",
    instructions:
      instructions.trim() ||
      "This is a sample worksheet preview showing how your questions will appear with the selected template.",
    questions: Array.from({ length: Math.min(5, Math.max(1, parsedQuestionCount)) }, (_, index) => ({
      id: `preview-${index + 1}`,
      type: "short",
      question: `Sample question ${index + 1}`,
    })),
  };

  const selectedTemplate =
    WORKSHEET_SYSTEM_TEMPLATES.find((t) => t.id === selectedTemplateId) ??
    WORKSHEET_SYSTEM_TEMPLATES[0];

  const clearDocument = () => {
    setSourceMaterial(null);
    setSourcePdfBase64(null);
    setSourcePdfFileName(null);
    setSourceName(null);
  };

  const handleGenerate = async () => {
    if (inputMode === "topic" && !topic.trim()) {
      toast({
        title: "Error",
        description: "Please enter a topic",
        variant: "destructive",
      });
      return;
    }
    if (inputMode === "document" && !sourceMaterial?.trim() && !sourcePdfBase64) {
      toast({
        title: "Error",
        description: "Please attach a document from Doc Center or upload a file",
        variant: "destructive",
      });
      return;
    }
    const gradeValue = grade === OTHER_OPTION_VALUE ? gradeCustom.trim() : grade;
    const difficultyValue = difficulty === OTHER_OPTION_VALUE ? difficultyCustom.trim() : difficulty;
    if (!gradeValue) {
      toast({
        title: "Error",
        description: grade === OTHER_OPTION_VALUE ? "Please enter a grade level" : "Please select a grade level",
        variant: "destructive",
      });
      return;
    }
    if (difficulty === OTHER_OPTION_VALUE && !difficultyValue) {
      toast({
        title: "Error",
        description: "Please enter a difficulty or choose from the list",
        variant: "destructive",
      });
      return;
    }
    const num = parseInt(questionCount, 10);
    if (isNaN(num) || num < 1 || num > 50) {
      toast({
        title: "Error",
        description: "Please enter a question count between 1 and 50",
        variant: "destructive",
      });
      return;
    }

    const response = await createWorksheet({
      templateId: selectedTemplateId,
      topic: inputMode === "topic" ? topic.trim() : (sourceName || "From document"),
      grade: gradeValue,
      difficulty: difficultyValue || "medium",
      instructions: instructions.trim() || undefined,
      questionCount: num,
      sourceMaterial: inputMode === "document" && !sourcePdfBase64 ? sourceMaterial ?? undefined : undefined,
      sourcePdfBase64: inputMode === "document" ? sourcePdfBase64 ?? undefined : undefined,
      sourcePdfFileName: inputMode === "document" ? sourcePdfFileName ?? undefined : undefined,
    });

    if (response?.success) {
      const savedContent = (response as { savedContent?: { id: string } })
        .savedContent;
      onContentGenerated?.();
      if (savedContent?.id) {
        toast({
          title: "Success",
          description: "Worksheet generated. Opening editor...",
        });
        router.push(`/dashboard/teacher/ai-studio/output/${savedContent.id}`);
      } else {
        toast({
          title: "Worksheet generated",
          description: "Could not save to history.",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Error",
        description:
          (response as { error?: string })?.error || "Failed to generate worksheet",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Worksheet Maker
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Choose a template (design only), then provide a topic or a document from
          Doc Center. AI will generate worksheet content as editable questions.
        </p>

        <div className="space-y-6">
          <div>
            <Label className="mb-2 block">Content source</Label>
            <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as "topic" | "document")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="topic">Topic</TabsTrigger>
                <TabsTrigger value="document">Document</TabsTrigger>
              </TabsList>
              <TabsContent value="topic" className="mt-3">
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Quadratic equations, World War II"
                />
              </TabsContent>
              <TabsContent value="document" className="mt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDocCenterOpen(true)}
                    disabled={loadingDoc}
                  >
                    {loadingDoc ? <Spinner size="sm" className="mr-2" /> : <FolderOpen className="h-4 w-4 mr-2" />}
                    {sourceName ? "Change document" : "Choose from Doc Center"}
                  </Button>
                  {sourceName && (
                    <Button type="button" variant="ghost" size="sm" onClick={clearDocument} title="Clear document">
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {sourceName && (
                  <p className="text-sm text-muted-foreground">
                    Using: {sourceName}
                    {sourcePdfBase64 != null ? " (PDF sent as-is)" : ` (${sourceMaterial?.length ?? 0} characters)`}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Allowed: {WORKSHEET_DOC_FORMATS.map((f) => f.toUpperCase()).join(", ")}. PDF is sent as-is to the AI. DOCX, DOC, and TXT are converted to text.
                </p>
                {sourceMaterial != null && sourcePdfBase64 == null && (sourceMaterial.length >= AI_SOURCE_TEXT_MAX_CHARS) && (
                  <div className="flex gap-2 rounded-lg border border-amber-500/60 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <p>
                      Source text exceeds the recommended length (~{AI_SOURCE_TEXT_MAX_CHARS.toLocaleString()} characters). Only the first part will be used. Use a PDF for full document content.
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
            <DocCenterMini
              open={docCenterOpen}
              onOpenChange={setDocCenterOpen}
              onSelect={handleDocCenterSelect}
              allowedFormats={WORKSHEET_DOC_FORMATS}
            />
          </div>

          <div>
            <Label className="mb-2 block">Template</Label>
            <p className="text-xs text-muted-foreground mb-3">
              Templates control layout and styling only; content is generated by
              AI.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {WORKSHEET_SYSTEM_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTemplateId(t.id)}
                  className={cn(
                    "rounded-lg border-2 p-4 text-left transition-colors",
                    selectedTemplateId === t.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <div
                    className="h-8 rounded border bg-muted/50 mb-2"
                    style={{ borderColor: t.styles.primaryColor }}
                  />
                  <div className="font-medium text-sm">{t.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {t.layout.header.showDate ? "Date in header" : "No date"}{" "}
                    · {t.layout.footer.showPageNumber ? "Page #" : "No page #"}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {selectedTemplate && (
            <Dialog>
              <DialogTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="mt-3">
                  Preview worksheet
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Worksheet preview</DialogTitle>
                  <DialogDescription>
                    Sample preview using the selected template. Actual questions will be generated by AI.
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-4 max-h-[70vh] overflow-y-auto rounded-lg border bg-muted/30 p-4">
                  <WorksheetTemplateLayout template={selectedTemplate} title={previewWorksheet.title}>
                    <WorksheetContentRender data={previewWorksheet} templateId={selectedTemplate.id} />
                  </WorksheetTemplateLayout>
                </div>
              </DialogContent>
            </Dialog>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="grade">Grade level *</Label>
              <Select value={grade} onValueChange={setGrade}>
                <SelectTrigger id="grade">
                  <SelectValue placeholder="Select grade" />
                </SelectTrigger>
                <SelectContent>
                  {GRADE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                  <SelectItem value={OTHER_OPTION_VALUE}>Other (type below)</SelectItem>
                </SelectContent>
              </Select>
              {grade === OTHER_OPTION_VALUE && (
                <Input
                  value={gradeCustom}
                  onChange={(e) => setGradeCustom(e.target.value)}
                  placeholder="Enter grade level"
                  className="mt-2"
                />
              )}
            </div>
            <div>
              <Label htmlFor="difficulty">Difficulty</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger id="difficulty">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIFFICULTY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                  <SelectItem value={OTHER_OPTION_VALUE}>Other (type below)</SelectItem>
                </SelectContent>
              </Select>
              {difficulty === OTHER_OPTION_VALUE && (
                <Input
                  value={difficultyCustom}
                  onChange={(e) => setDifficultyCustom(e.target.value)}
                  placeholder="e.g. Intermediate, Advanced"
                  className="mt-2"
                />
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="questionCount">Question count</Label>
              <Input
                id="questionCount"
                type="number"
                min={1}
                max={50}
                value={questionCount}
                onChange={(e) => setQuestionCount(e.target.value)}
              />
          </div>

          <div>
            <Label htmlFor="instructions">Special instructions (optional)</Label>
            <Textarea
              id="instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. Focus on word problems, include one proof, mix question types"
              rows={3}
              className="resize-y"
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Generating Worksheet...
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Generate Worksheet
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default WorksheetGenerator;
