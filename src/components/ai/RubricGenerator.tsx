import { useState } from "react";
import { useRouter } from "next/router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAIStudio } from "@/hooks/useAIStudio";
import { AI_SOURCE_TEXT_MAX_CHARS } from "@/services/aiService";
import { DocCenterMini, type DocCenterSelection } from "@/components/ai/DocCenterMini";
import { FileText, FolderOpen, ListChecks, Loader2, X, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RubricGeneratorProps {
  onContentGenerated?: () => void;
}

const RUBRIC_DOC_FORMATS = ["pdf", "txt", "doc", "docx"];

const RubricGenerator = ({ onContentGenerated }: RubricGeneratorProps) => {
  const router = useRouter();
  const { createRubric, loading } = useAIStudio();
  const { toast } = useToast();
  const [assignmentDescription, setAssignmentDescription] = useState("");
  const [sourceMaterial, setSourceMaterial] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [docCenterOpen, setDocCenterOpen] = useState(false);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [inputTab, setInputTab] = useState<"text" | "document">("text");

  const extFromName = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

  const handleDocCenterSelect = async (selection: DocCenterSelection) => {
    if (selection.type === "file") {
      const ext = extFromName(selection.file.name);
      if (!RUBRIC_DOC_FORMATS.includes(ext)) {
        toast({
          title: "Invalid file",
          description: `Rubric Generator allows: ${RUBRIC_DOC_FORMATS.map((f) => f.toUpperCase()).join(", ")}.`,
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
        const res = await fetch("/api/documents/extract-file", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64, fileName: selection.file.name }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Extraction failed");
        const text = (data.text as string | undefined)?.trim() ?? "";
        if (!text) throw new Error("No text found in the file. Try a different file or paste the content.");
        setSourceMaterial(text);
        setSourceName((data.name as string | undefined) ?? selection.file.name);
        setDocCenterOpen(false);
        setInputTab("document");
        toast({ title: "Document ready", description: `Using "${(data.name as string | undefined) ?? selection.file.name}"` });
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
    if (!RUBRIC_DOC_FORMATS.includes(ext)) {
      toast({
        title: "Invalid document",
        description: `Rubric Generator allows: ${RUBRIC_DOC_FORMATS.map((f) => f.toUpperCase()).join(", ")}.`,
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
      const text = (data.text as string | undefined)?.trim() ?? "";
      if (!text) throw new Error("No text found in the document. Try a different document or paste the content.");
      setSourceMaterial(text);
      setSourceName((data.name as string | undefined) ?? doc.name);
      setDocCenterOpen(false);
      setInputTab("document");
      toast({ title: "Document ready", description: `Using "${(data.name as string | undefined) ?? doc.name}"` });
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
  };

  const handleGenerate = async () => {
    const hasDescription = assignmentDescription.trim().length > 0;
    const hasDoc = (sourceMaterial?.trim().length ?? 0) > 0;
    if (!hasDescription && !hasDoc) {
      toast({
        title: "Error",
        description: "Provide an assignment description or attach a document with instructions.",
        variant: "destructive",
      });
      return;
    }

    const response = await createRubric({
      assignmentDescription: assignmentDescription.trim() || undefined,
      sourceMaterial: sourceMaterial?.trim() || undefined,
      sourceName: sourceName || undefined,
    });

    if (response?.success && response.content) {
      const savedContent = (response as { savedContent?: { id: string } }).savedContent;
      toast({
        title: "Success",
        description: "Rubric generated successfully. Opening output...",
      });
      onContentGenerated?.();
      if (savedContent?.id) {
        router.push(`/dashboard/teacher/ai-studio/output/${savedContent.id}`);
      }
    } else {
      toast({
        title: "Error",
        description: (response as { error?: string })?.error || "Failed to generate rubric",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Rubric Generator</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Provide an assignment description as text or from a document. The generated rubric will open on a separate page where you can edit, regenerate criteria, and export to PDF.
        </p>

        <Tabs value={inputTab} onValueChange={(v) => setInputTab(v as "text" | "document")} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="text">Text</TabsTrigger>
            <TabsTrigger value="document">Document</TabsTrigger>
          </TabsList>
          <TabsContent value="text" className="mt-4 space-y-2">
            <Label htmlFor="assignment">Assignment description</Label>
            <Textarea
              id="assignment"
              value={assignmentDescription}
              onChange={(e) => setAssignmentDescription(e.target.value)}
              placeholder="Describe the assignment, objectives, requirements, and what students should demonstrate..."
              rows={8}
            />
          </TabsContent>
          <TabsContent value="document" className="mt-4 space-y-2">
            <Label className="block">Document with instructions</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDocCenterOpen(true)}
              disabled={loadingDoc}
              className="w-full sm:w-auto"
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              Choose from Doc Center or upload
            </Button>
            {sourceName ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate">{sourceName}</span>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={clearDocument} aria-label="Remove document">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                PDF, Word, or text file containing the assignment brief or rubric instructions.
              </p>
            )}
            {(sourceMaterial?.length ?? 0) >= AI_SOURCE_TEXT_MAX_CHARS && (
              <div className="flex gap-2 rounded-lg border border-amber-500/60 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>
                  Source material exceeds the recommended length (~{AI_SOURCE_TEXT_MAX_CHARS.toLocaleString()} characters). Only the first part will be sent to the AI.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="mt-4">
          <Button onClick={handleGenerate} disabled={loading || loadingDoc} className="w-full">
            {loading || loadingDoc ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {loadingDoc ? "Preparing document..." : "Generating Rubric..."}
              </>
            ) : (
              <>
                <ListChecks className="h-4 w-4 mr-2" />
                Generate Rubric
              </>
            )}
          </Button>
        </div>
      </Card>

      <DocCenterMini
        open={docCenterOpen}
        onOpenChange={setDocCenterOpen}
        onSelect={handleDocCenterSelect}
        allowedFormats={RUBRIC_DOC_FORMATS}
      />
    </div>
  );
};

export default RubricGenerator;
