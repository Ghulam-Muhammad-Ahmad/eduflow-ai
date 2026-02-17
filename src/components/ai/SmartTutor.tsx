import { useState } from "react";
import { useRouter } from "next/router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { useAIStudio } from "@/hooks/useAIStudio";
import { Loader2, Upload, FileText, X, FolderOpen, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DocCenterMini, type DocCenterSelection } from "@/components/ai/DocCenterMini";
import { supabase } from "@/integrations/supabase/client";

interface SmartTutorProps {
  onContentGenerated?: () => void;
}

const convertPdfToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      resolve(base64 ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const SmartTutor = ({ onContentGenerated }: SmartTutorProps) => {
  const router = useRouter();
  const { smartTutorContent, loading } = useAIStudio();
  const { toast } = useToast();
  const [inputMode, setInputMode] = useState<"upload" | "paste">("upload");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [targetLevel, setTargetLevel] = useState<
    "below_grade" | "at_grade" | "above_grade"
  >("at_grade");
  const [subject, setSubject] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [docCenterOpen, setDocCenterOpen] = useState(false);
  const [loadingDoc, setLoadingDoc] = useState(false);

  const SMART_TUTOR_FORMATS = ["pdf", "txt", "doc", "docx"];

  const handleDocCenterSelect = async (selection: DocCenterSelection) => {
    const extFromName = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";
    if (selection.type === "file") {
      const ext = extFromName(selection.file.name);
      if (SMART_TUTOR_FORMATS.includes(ext)) {
        setPdfFile(selection.file);
      } else {
        toast({
          title: "Invalid file",
          description: `Smart Tutor allows only: ${SMART_TUTOR_FORMATS.join(", ").toUpperCase()}.`,
          variant: "destructive",
        });
      }
      return;
    }
    const doc = selection.doc;
    const ext = extFromName(doc.name);
    if (!SMART_TUTOR_FORMATS.includes(ext)) {
      toast({
        title: "Invalid document",
        description: `Smart Tutor allows only: ${SMART_TUTOR_FORMATS.join(", ").toUpperCase()}.`,
        variant: "destructive",
      });
      return;
    }
    setLoadingDoc(true);
    try {
      const { data, error } = await supabase.storage
        .from("documents")
        .download(doc.file_path);
      if (error) throw error;
      const file = new File([data], doc.name, { type: doc.file_type || "application/pdf" });
      setPdfFile(file);
      toast({ title: "Document selected", description: `Using "${doc.name}"` });
    } catch (e) {
      toast({
        title: "Could not load document",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingDoc(false);
    }
  };

  const clearFile = () => setPdfFile(null);

  const handleRun = async () => {
    if (!subject || !gradeLevel) {
      toast({
        title: "Error",
        description: "Please select subject and grade level",
        variant: "destructive",
      });
      return;
    }

    if (inputMode === "upload") {
      if (!pdfFile) {
        toast({
          title: "Error",
          description: "Please upload a PDF document",
          variant: "destructive",
        });
        return;
      }
    } else {
      if (!pastedText.trim()) {
        toast({
          title: "Error",
          description: "Please enter or paste content to adapt",
          variant: "destructive",
        });
        return;
      }
    }

    const payload: {
      pastedText?: string;
      pdfBase64?: string;
      fileName?: string;
      targetLevel: "below_grade" | "at_grade" | "above_grade";
      subject: string;
      gradeLevel: string;
    } = {
      targetLevel,
      subject,
      gradeLevel,
    };

    if (inputMode === "upload" && pdfFile) {
      try {
        payload.pdfBase64 = await convertPdfToBase64(pdfFile);
        payload.fileName = pdfFile.name;
      } catch {
        toast({
          title: "Error",
          description: "Failed to read the file",
          variant: "destructive",
        });
        return;
      }
    } else {
      payload.pastedText = pastedText.trim();
    }

    const response = await smartTutorContent(payload);

    if (response?.success && response.content) {
      const savedContent = (response as { savedContent?: { id: string } }).savedContent;
      onContentGenerated?.();
      toast({
        title: "Success",
        description: "Content adapted successfully. Opening output...",
      });
      if (savedContent?.id) {
        router.push(`/dashboard/teacher/ai-studio/output/${savedContent.id}`);
      }
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Smart Tutor</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Upload a document or paste content and Get content adapted for your
          chosen level.
        </p>

        <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as "upload" | "paste")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload document
            </TabsTrigger>
            <TabsTrigger value="paste" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Paste content
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4 mt-4">
            <div>
              <Label>Document (PDF)</Label>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => setDocCenterOpen(true)}
                  disabled={loadingDoc}
                >
                  {loadingDoc ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FolderOpen className="h-4 w-4" />
                  )}
                  Choose from Document Center
                </Button>
                {pdfFile && (
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    {pdfFile.name}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={clearFile}
                      aria-label="Remove file"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </span>
                )}
              </div>
            </div>
            <DocCenterMini
              open={docCenterOpen}
              onOpenChange={setDocCenterOpen}
              onSelect={handleDocCenterSelect}
              allowedFormats={["pdf", "txt", "doc", "docx"]}
            />
          </TabsContent>

          <TabsContent value="paste" className="space-y-4 mt-4">
            <div>
              <Label htmlFor="original">Content to smarten *</Label>
              <Textarea
                id="original"
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Paste the content here..."
                rows={8}
                className="mt-2"
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="grid md:grid-cols-3 gap-4 mt-4">
          <div>
            <Label>Target level</Label>
            <Select value={targetLevel} onValueChange={(v: "below_grade" | "at_grade" | "above_grade") => setTargetLevel(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="below_grade">Below grade level</SelectItem>
                <SelectItem value="at_grade">At grade level</SelectItem>
                <SelectItem value="above_grade">Above grade level</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Subject</Label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger>
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
            <Label>Grade level</Label>
            <Select value={gradeLevel} onValueChange={setGradeLevel}>
              <SelectTrigger>
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

        <Button
          onClick={handleRun}
          disabled={loading}
          className="w-full mt-4"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Smartening...
            </>
          ) : (
            <>
            <Sparkles className="h-4 w-4 mr-2" />
              Smarten the content
            </>
          )}
        </Button>
      </Card>
    </div>
  );
};

export default SmartTutor;
