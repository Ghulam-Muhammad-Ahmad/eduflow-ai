import { useState } from "react";
import { useRouter } from "next/router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAIStudio } from "@/hooks/useAIStudio";
import type { PaperQuestionType } from "@/services/aiService";
import { DocCenterMini, type DocCenterSelection } from "@/components/ai/DocCenterMini";
import { FileText, Loader2, FolderOpen, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const QUESTION_TYPES: { value: PaperQuestionType; label: string }[] = [
  { value: "multiple_choice", label: "Multiple choice" },
  { value: "short_answer", label: "Short answer" },
  { value: "long_answer", label: "Long answer" },
  { value: "true_false", label: "True/False" },
];

interface PaperGeneratorProps {
  onContentGenerated?: () => void;
}

const PAPER_DOC_FORMATS = ["pdf", "txt", "doc", "docx"];

const PaperGenerator = ({ onContentGenerated }: PaperGeneratorProps) => {
  const router = useRouter();
  const { createPaper, loading } = useAIStudio();
  const { toast } = useToast();

  const [inputMode, setInputMode] = useState<"topic" | "document">("topic");
  const [subject, setSubject] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [topic, setTopic] = useState("");
  const [sourceMaterial, setSourceMaterial] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [sourcePdfBase64, setSourcePdfBase64] = useState<string | null>(null);
  const [sourcePdfFileName, setSourcePdfFileName] = useState<string | null>(null);
  const [customInstruction, setCustomInstruction] = useState("");
  const [docCenterOpen, setDocCenterOpen] = useState(false);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [duration, setDuration] = useState<string>("");
  const [totalMarks, setTotalMarks] = useState<string>("");
  const [questionTypes, setQuestionTypes] = useState<PaperQuestionType[]>([
    "multiple_choice",
    "short_answer",
  ]);
  const [numQuestions, setNumQuestions] = useState<string>("10");
  const [lastGeneratedPaper, setLastGeneratedPaper] = useState<string | null>(null);

  const handleDocCenterSelect = async (selection: DocCenterSelection) => {
    const extFromName = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";
    if (selection.type === "file") {
      const ext = extFromName(selection.file.name);
      if (!PAPER_DOC_FORMATS.includes(ext)) {
        toast({
          title: "Invalid file",
          description: `Paper Generator allows: ${PAPER_DOC_FORMATS.map((f) => f.toUpperCase()).join(", ")}.`,
          variant: "destructive",
        });
        return;
      }
      setLoadingDoc(true);
      try {
        const bytes = await selection.file.arrayBuffer();
        const arr = new Uint8Array(bytes);
        if (ext === "pdf") {
          let binary = "";
          const chunk = 8192;
          for (let i = 0; i < arr.length; i += chunk) {
            binary += String.fromCharCode(...arr.subarray(i, i + chunk));
          }
          const base64 = btoa(binary);
          setSourcePdfBase64(base64);
          setSourcePdfFileName(selection.file.name);
          setSourceMaterial(null);
          setSourceName(selection.file.name);
          setDocCenterOpen(false);
          toast({ title: "Document ready", description: `Using PDF as-is: "${selection.file.name}"` });
        } else {
          let binary = "";
          const chunk = 8192;
          for (let i = 0; i < arr.length; i += chunk) {
            binary += String.fromCharCode(...arr.subarray(i, i + chunk));
          }
          const base64 = btoa(binary);
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
    if (!PAPER_DOC_FORMATS.includes(ext)) {
      toast({
        title: "Invalid document",
        description: `Paper Generator allows: ${PAPER_DOC_FORMATS.map((f) => f.toUpperCase()).join(", ")}.`,
        variant: "destructive",
      });
      return;
    }
    setSourcePdfBase64(null);
    setSourcePdfFileName(null);
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

  const clearDocument = () => {
    setSourceMaterial(null);
    setSourceName(null);
    setSourcePdfBase64(null);
    setSourcePdfFileName(null);
  };

  const toggleQuestionType = (type: PaperQuestionType) => {
    setQuestionTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleGenerate = async () => {
    setLastGeneratedPaper(null);
    if (!subject.trim()) {
      toast({
        title: "Error",
        description: "Please select a subject",
        variant: "destructive",
      });
      return;
    }
    if (!gradeLevel.trim()) {
      toast({
        title: "Error",
        description: "Please select a grade level",
        variant: "destructive",
      });
      return;
    }
    if (inputMode === "topic") {
      if (!topic.trim()) {
        toast({
          title: "Error",
          description: "Please enter a topic",
          variant: "destructive",
        });
        return;
      }
    } else {
      const hasSource = (sourceMaterial?.trim()?.length ?? 0) > 0 || (sourcePdfBase64?.length ?? 0) > 0;
      if (!hasSource) {
        toast({
          title: "Error",
          description: "Please attach a document from Doc Center or upload a file",
          variant: "destructive",
        });
        return;
      }
    }
    const types = questionTypes.length ? questionTypes : (["multiple_choice", "short_answer"] as PaperQuestionType[]);
    const num = parseInt(numQuestions, 10);
    if (isNaN(num) || num < 1 || num > 50) {
      toast({
        title: "Error",
        description: "Please enter a number of questions between 1 and 50",
        variant: "destructive",
      });
      return;
    }

    const topicLabel = topic.trim() || sourceName || "From document";

    const response = await createPaper({
      subject,
      gradeLevel,
      topic: topicLabel,
      sourceMaterial: sourcePdfBase64 ? undefined : (sourceMaterial?.trim() || undefined),
      sourcePdfBase64: sourcePdfBase64 ?? undefined,
      sourcePdfFileName: sourcePdfFileName ?? undefined,
      customInstruction: customInstruction.trim() || undefined,
      duration: duration ? parseInt(duration, 10) : undefined,
      questionTypes: types,
      numQuestions: num,
      totalMarks: totalMarks ? parseInt(totalMarks, 10) : undefined,
    });

    if (response?.success && response.content) {
      const savedContent = (response as { savedContent?: { id: string } }).savedContent;
      onContentGenerated?.();
      if (savedContent?.id) {
        toast({
          title: "Success",
          description: "Paper generated and saved. Opening output...",
        });
        router.push(`/dashboard/teacher/ai-studio/output/${savedContent.id}`);
      } else {
        setLastGeneratedPaper(response.content);
        toast({
          title: "Paper generated",
          description: "Could not save to history. You can view and copy the content below.",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Error",
        description: (response as { error?: string })?.error || "Failed to generate paper",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Paper Generator
        </h2>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="subject">Subject *</Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger id="subject">
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Math">Math</SelectItem>
                  <SelectItem value="Science">Science</SelectItem>
                  <SelectItem value="English">English</SelectItem>
                  <SelectItem value="History">History</SelectItem>
                  <SelectItem value="Geography">Geography</SelectItem>
                  <SelectItem value="Art">Art</SelectItem>
                  <SelectItem value="Computer Science">Computer Science</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="grade">Grade level *</Label>
              <Select value={gradeLevel} onValueChange={setGradeLevel}>
                <SelectTrigger id="grade">
                  <SelectValue placeholder="Select grade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Elementary">Elementary (K-5)</SelectItem>
                  <SelectItem value="Middle School">Middle School (6-8)</SelectItem>
                  <SelectItem value="High School">High School (9-12)</SelectItem>
                  <SelectItem value="College">College</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <hr className="my-4" />
          <div>
            <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as "topic" | "document")} className="mt-2">
              <TabsList className="grid w-fit grid-cols-2">
                <TabsTrigger value="topic" className="w-full">Enter topic</TabsTrigger>
                <TabsTrigger value="document" className="w-full ">Attach document</TabsTrigger>
              </TabsList>
              <TabsContent value="topic" className="mt-3">
                <Input
                  id="topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Quadratic equations, World War II, Cell biology"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  The paper will be generated around this topic.
                </p>
              </TabsContent>
              <TabsContent value="document" className="mt-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDocCenterOpen(true)}
                    disabled={loadingDoc}
                  >
                    {loadingDoc ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FolderOpen className="h-4 w-4 mr-2" />
                    )}
                    Choose from Doc Center or upload
                  </Button>
                  {sourceName && (
                    <Button type="button" variant="ghost" size="sm" onClick={clearDocument} aria-label="Clear document">
                      <X className="h-4 w-4 mr-1" />
                      Clear
                    </Button>
                  )}
                </div>
                {(sourceMaterial != null || sourcePdfBase64 != null) && sourceName && (
                  <p className="text-sm text-muted-foreground">
                    Using: <span className="font-medium text-foreground">{sourceName}</span>
                    {sourcePdfBase64 != null ? " (PDF sent as-is)" : ` (${sourceMaterial?.length ?? 0} characters)`}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  PDF is sent as-is to the AI. DOCX, DOC, and TXT are converted to text. The paper will be based on the document content.
                </p>
                <DocCenterMini
                  open={docCenterOpen}
                  onOpenChange={setDocCenterOpen}
                  onSelect={handleDocCenterSelect}
                  allowedFormats={PAPER_DOC_FORMATS}
                />
              </TabsContent>
            </Tabs>
            {inputMode === "document" && (
              <div className="mt-2">
                <Label htmlFor="topic-label" className="text-muted-foreground font-normal">Topic label (optional)</Label>
                <Input
                  id="topic-label"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Chapter 5, Unit 2"
                  className="mt-1"
                />
              </div>
            )}
          </div>
            <hr className="my-4" />
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                min={5}
                max={180}
                placeholder="e.g. 60"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="totalMarks">Total marks</Label>
              <Input
                id="totalMarks"
                type="number"
                min={1}
                placeholder="e.g. 100"
                value={totalMarks}
                onChange={(e) => setTotalMarks(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="numQuestions">Number of questions *</Label>
              <Input
                id="numQuestions"
                type="number"
                min={1}
                max={50}
                value={numQuestions}
                onChange={(e) => setNumQuestions(e.target.value)}
              />
            </div>
          </div>

          <hr className="my-4" />
          <div>
            <Label>Question types</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Select at least one. The paper will include a mix of these types.
            </p>
            <div className="flex flex-wrap gap-4">
              {QUESTION_TYPES.map(({ value, label }) => (
                <label
                  key={value}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={questionTypes.includes(value)}
                    onChange={() => toggleQuestionType(value)}
                    className="rounded border-input"
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <hr className="my-4" />
          <div>
            <Label htmlFor="customInstruction">Custom instructions (optional)</Label>
            <Input
              id="customInstruction"
              value={customInstruction}
              onChange={(e) => setCustomInstruction(e.target.value)}
              placeholder="e.g. Focus on application questions, include one diagram, avoid trick questions"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              Additional instructions for how the paper should be generated.
            </p>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Paper...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Generate Paper
              </>
            )}
          </Button>
        </div>
      </Card>

      {lastGeneratedPaper && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Generated paper</h2>
          <p className="text-sm text-muted-foreground mb-4">
            This paper was generated but could not be saved to history. Copy the content below or generate again to retry saving.
          </p>
          <div className="prose rounded-lg p-4 bg-muted/30 max-w-none dark:prose-invert reactMarkdownCustom">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{lastGeneratedPaper}</ReactMarkdown>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => {
              navigator.clipboard.writeText(lastGeneratedPaper ?? "");
              toast({ title: "Copied", description: "Paper content copied to clipboard." });
            }}
          >
            Copy to clipboard
          </Button>
        </Card>
      )}
    </div>
  );
};

export default PaperGenerator;
