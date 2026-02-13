import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAssignments } from "@/hooks/useAssignments";
import { useClassrooms } from "@/hooks/useClassrooms";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Sparkles, Paperclip, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";

const ASSIGNMENT_AI_SYSTEM = `You are an educational assistant. Return ONLY valid JSON with exactly these keys: title (string), description (string), instructions (string), points_possible (number between 0 and 100). No markdown, no code blocks, no explanation—only the raw JSON object.`;

const TeacherCreateAssignment = () => {
  const router = useRouter();
  useAuth();
  const {
    createAssignment,
    teacherDocuments,
    addAssignmentAttachments,
  } = useAssignments();
  const { classrooms } = useClassrooms();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [classroomId, setClassroomId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [pointsPossible, setPointsPossible] = useState("100");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [attachedDocumentIds, setAttachedDocumentIds] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const handleGenerateWithAI = async () => {
    if (!aiPrompt.trim()) return;
    setAiGenerating(true);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType: "content_generation",
          prompt: aiPrompt.trim(),
          systemInstruction: ASSIGNMENT_AI_SYSTEM,
        }),
      });
      if (!res.ok) {
        let errorMessage = `AI request failed (${res.status})`;
        try {
          const errorData = await res.json();
          if (errorData?.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // Ignore JSON parsing errors for non-OK responses.
        }
        toast.error(errorMessage);
        return;
      }
      const data = await res.json();
      if (!data.success || !data.content) {
        toast.error(data.error || "Failed to generate assignment");
        return;
      }
      let jsonStr = data.content.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
      }
      const parsed = JSON.parse(jsonStr);
      if (parsed.title) setTitle(parsed.title);
      if (parsed.description != null) setDescription(parsed.description);
      if (parsed.instructions != null) setInstructions(parsed.instructions);
      if (typeof parsed.points_possible === "number") {
        setPointsPossible(String(Math.min(100, Math.max(0, parsed.points_possible))));
      }
      toast.success("Assignment fields filled from AI");
    } catch (e) {
      console.error(e);
      toast.error("Could not parse AI response. Try a clearer prompt.");
    } finally {
      setAiGenerating(false);
    }
  };

  const toggleDocumentAttachment = (docId: string) => {
    setAttachedDocumentIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const handleCreate = async () => {
    if (!title.trim() || !classroomId) {
      toast.error("Please provide a title and classroom before saving.");
      return;
    }

    setIsCreating(true);
    try {
      const assignment = await createAssignment.mutateAsync({
        title: title.trim(),
        description: description.trim() || null,
        instructions: instructions.trim() || null,
        classroom_id: classroomId,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        points_possible: parseInt(pointsPossible) || 100,
        status: "draft",
      });

      if (assignment?.id && attachedDocumentIds.length > 0) {
        await addAssignmentAttachments(assignment.id, attachedDocumentIds);
      }

      toast.success("Assignment saved as draft");
      router.push("/dashboard/teacher/assignments");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to create assignment");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 w-full">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/teacher/assignments">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Create New Assignment</h1>
            <p className="text-muted-foreground mt-1">
              Set up a new assignment. Use AI to fill fields, attach documents, then save as draft.
            </p>
          </div>
        </div>

        {/* AI prompt */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Generate with AI
            </CardTitle>
            <CardDescription>
              Describe the assignment and we&apos;ll fill title, description, instructions, and points.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Textarea
                placeholder="e.g., Mid-term essay on To Kill a Mockingbird, 800 words, analyze themes..."
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                rows={2}
                className="resize-none"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleGenerateWithAI}
                disabled={!aiPrompt.trim() || aiGenerating}
                className="shrink-0"
              >
                {aiGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-1" />
                    Fill
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Assignment details */}
        <Card>
          <CardHeader>
            <CardTitle>Assignment details</CardTitle>
            <CardDescription>Title, classroom, due date, and instructions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Classroom *</Label>
                <Select value={classroomId} onValueChange={setClassroomId}>
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
              <div className="space-y-2">
                <Label>Points</Label>
                <Input
                  type="number"
                  placeholder="100"
                  value={pointsPossible}
                  onChange={(e) => setPointsPossible(e.target.value)}
                  min="0"
                  max="100"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                placeholder="e.g., Chapter 5 Essay"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Brief description of the assignment..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Instructions</Label>
              <Textarea
                placeholder="Detailed instructions for students..."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Attach documents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Paperclip className="h-4 w-4 text-primary" />
              Attach documents
            </CardTitle>
            <CardDescription>
              Attach documents from your Documents library for students to reference.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {teacherDocuments && teacherDocuments.length > 0 ? (
              <div className="max-h-40 overflow-y-auto space-y-2 rounded border border-border bg-secondary/30 p-3">
                {teacherDocuments.map((doc: { id: string; name: string; file_type?: string }) => (
                  <label
                    key={doc.id}
                    className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-secondary"
                  >
                    <Checkbox
                      checked={attachedDocumentIds.includes(doc.id)}
                      onCheckedChange={() => toggleDocumentAttachment(doc.id)}
                    />
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">{doc.name}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No documents yet. Upload files in Documents first, then they will appear here.
              </p>
            )}
            {attachedDocumentIds.length > 0 && (
              <p className="text-sm text-primary mt-2">
                {attachedDocumentIds.length} document{attachedDocumentIds.length !== 1 ? "s" : ""} attached
              </p>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <Link href="/dashboard/teacher/assignments">Cancel</Link>
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!title.trim() || !classroomId || createAssignment.isPending || isCreating}
          >
            {createAssignment.isPending || isCreating ? "Saving..." : "Save as Draft"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TeacherCreateAssignment;
