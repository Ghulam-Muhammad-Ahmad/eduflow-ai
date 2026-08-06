import { useCallback, useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAssignments } from "@/hooks/useAssignments";
import { useClassrooms } from "@/hooks/useClassrooms";
import { useOneToOneRooms } from "@/hooks/useOneToOneRooms";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
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
import { DocCenterMini, type DocCenterSelection } from "@/components/ai/DocCenterMini";
import { ArrowLeft, Sparkles, Paperclip, FileText, FolderOpen } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";

const ASSIGNMENT_AI_SYSTEM = `You are an educational assistant. Return ONLY valid JSON with exactly these keys: title (string), description (string), instructions (string), points_possible (number between 0 and 100). No markdown, no code blocks, no explanation—only the raw JSON object.`;

type AssignmentRow = {
  id: string;
  title: string | null;
  description: string | null;
  instructions: string | null;
  due_date: string | null;
  points_possible: number | null;
  status: string;
  classroom_id: string | null;
  one_to_one_room_id: string | null;
  assignment_attachments?: { document_id: string; documents?: { id: string; name: string } | null }[];
};

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

export default function TeacherEditAssignment() {
  const router = useRouter();
  const assignmentId = typeof router.query.assignmentId === "string" ? router.query.assignmentId : null;
  useAuth();
  const queryClient = useQueryClient();
  const { updateAssignment, teacherDocuments, addAssignmentAttachments } = useAssignments();
  const { classrooms } = useClassrooms();
  const { oneToOneRooms } = useOneToOneRooms();

  const { data: assignment, isLoading: assignmentLoading, error: assignmentError } = useQuery({
    queryKey: ["assignment-edit", assignmentId],
    queryFn: async (): Promise<AssignmentRow | null> => {
      if (!assignmentId) return null;
      const { data, error } = await supabase
        .from("assignments")
        .select(`
          id,
          title,
          description,
          instructions,
          due_date,
          points_possible,
          status,
          classroom_id,
          one_to_one_room_id,
          assignment_attachments ( document_id, documents ( id, name ) )
        `)
        .eq("id", assignmentId)
        .single();
      if (error) throw error;
      return data as unknown as AssignmentRow;
    },
    enabled: !!assignmentId,
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [targetType, setTargetType] = useState<"classroom" | "1v1">("classroom");
  const [classroomId, setClassroomId] = useState("");
  const [oneToOneRoomId, setOneToOneRoomId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [pointsPossible, setPointsPossible] = useState("100");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [attachedDocumentIds, setAttachedDocumentIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [docCenterOpen, setDocCenterOpen] = useState(false);

  const handleDocCenterSelect = useCallback(
    (selection: DocCenterSelection) => {
      // Uploading inside the modal doesn't emit a selectable document id; ignore it defensively.
      if (selection.type !== "document") return;
      setAttachedDocumentIds((prev) =>
        prev.includes(selection.doc.id) ? prev : [...prev, selection.doc.id]
      );
      // The checkbox list below is fed by a different query key than the modal, so a
      // freshly uploaded document only shows up once this is refetched.
      queryClient.invalidateQueries({ queryKey: ["teacher-documents"] });
      toast.success(`Attached "${selection.doc.name}"`);
    },
    [queryClient]
  );

  useEffect(() => {
    if (!assignment) return;
    setTitle(assignment.title ?? "");
    setDescription(assignment.description ?? "");
    setInstructions(assignment.instructions ?? "");
    setDueDate(toDatetimeLocal(assignment.due_date));
    setPointsPossible(String(assignment.points_possible ?? 100));
    if (assignment.classroom_id) {
      setTargetType("classroom");
      setClassroomId(assignment.classroom_id);
      setOneToOneRoomId("");
    } else if (assignment.one_to_one_room_id) {
      setTargetType("1v1");
      setOneToOneRoomId(assignment.one_to_one_room_id);
      setClassroomId("");
    }
    const docIds = (assignment.assignment_attachments ?? [])
      .map((a) => a.document_id || (a.documents?.id ?? ""))
      .filter(Boolean);
    setAttachedDocumentIds(docIds);
  }, [assignment]);

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
        const errorData = await res.json().catch(() => ({}));
        toast.error((errorData as { error?: string }).error || "AI request failed");
        return;
      }
      const data = await res.json();
      if (!data.success || !data.content) {
        toast.error(data.error || "Failed to generate assignment");
        return;
      }
      let jsonStr = (data.content as string).trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
      }
      const parsed = JSON.parse(jsonStr) as { title?: string; description?: string; instructions?: string; points_possible?: number };
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

  const handleSave = async () => {
    if (!assignmentId) return;
    const hasClassroom = targetType === "classroom" && classroomId;
    const hasRoom = targetType === "1v1" && oneToOneRoomId;
    if (!title.trim() || (!hasClassroom && !hasRoom)) {
      toast.error("Please provide a title and select a classroom or 1v1 room before saving.");
      return;
    }

    setIsSaving(true);
    try {
      await updateAssignment.mutateAsync({
        id: assignmentId,
        title: title.trim(),
        description: description.trim() || null,
        instructions: instructions.trim() || null,
        classroom_id: targetType === "classroom" ? classroomId : null,
        one_to_one_room_id: targetType === "1v1" ? oneToOneRoomId : null,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        points_possible: parseInt(pointsPossible, 10) || 100,
      });

      await supabase.from("assignment_attachments").delete().eq("assignment_id", assignmentId);
      if (attachedDocumentIds.length > 0) {
        await addAssignmentAttachments(assignmentId, attachedDocumentIds);
      }

      toast.success("Assignment updated");
      router.push("/dashboard/teacher/assignments");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to update assignment");
    } finally {
      setIsSaving(false);
    }
  };

  if (assignmentId && (assignmentLoading || assignmentError)) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-16">
          {assignmentLoading && <Spinner size="lg" className="text-muted-foreground" />}
          {assignmentError && (
            <>
              <p className="text-destructive mb-4">This assignment could not be loaded.</p>
              <Button variant="outline" asChild>
                <Link href="/dashboard/teacher/assignments">Back to Assignments</Link>
              </Button>
            </>
          )}
        </div>
      </DashboardLayout>
    );
  }

  if (assignmentId && !assignment) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-muted-foreground mb-4">Assignment not found.</p>
          <Button variant="outline" asChild>
            <Link href="/dashboard/teacher/assignments">Back to Assignments</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const hasClassroom = targetType === "classroom" && classroomId;
  const hasRoom = targetType === "1v1" && oneToOneRoomId;
  const canSave = title.trim() && (hasClassroom || hasRoom);

  return (
    <DashboardLayout>
      <div className="space-y-6 w-full">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/teacher/assignments">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Edit Assignment</h1>
            <p className="text-muted-foreground mt-1">
              Update title, description, instructions, due date, and attachments.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Generate with AI
            </CardTitle>
            <CardDescription>
              Describe changes and we&apos;ll fill title, description, instructions, and points.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Textarea
                placeholder="e.g., Mid-term essay on To Kill a Mockingbird, 800 words..."
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
                {aiGenerating ? <Spinner size="sm" /> : <> <Sparkles className="h-4 w-4 mr-1" /> Fill </>}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assignment details</CardTitle>
            <CardDescription>Title, classroom, due date, and instructions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Assign to *</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="targetType"
                    checked={targetType === "classroom"}
                    onChange={() => setTargetType("classroom")}
                    className="rounded border-input"
                  />
                  <span>Classroom</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="targetType"
                    checked={targetType === "1v1"}
                    onChange={() => setTargetType("1v1")}
                    className="rounded border-input"
                  />
                  <span>1v1 Room</span>
                </label>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {targetType === "classroom" ? (
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
              ) : (
                <div className="space-y-2">
                  <Label>1v1 Room *</Label>
                  <Select value={oneToOneRoomId} onValueChange={setOneToOneRoomId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select 1v1 room" />
                    </SelectTrigger>
                    <SelectContent>
                      {oneToOneRooms?.map((room) => (
                        <SelectItem key={room.id} value={room.id}>
                          {room.name || `${room.studentProfile?.display_name ?? "Student"} (1v1)`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Points</Label>
                <Input
                  type="number"
                  placeholder="100"
                  value={pointsPossible}
                  onChange={(e) => setPointsPossible(e.target.value)}
                  min={0}
                  max={100}
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
            <div className="mb-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDocCenterOpen(true)}
              >
                <FolderOpen className="h-4 w-4 mr-1.5" />
                Choose from Doc Center
              </Button>
            </div>
            <DocCenterMini
              open={docCenterOpen}
              onOpenChange={setDocCenterOpen}
              onSelect={handleDocCenterSelect}
            />
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
                No documents yet. Use “Choose from Doc Center” above to upload one.
              </p>
            )}
            {attachedDocumentIds.length > 0 && (
              <p className="text-sm text-primary mt-2">
                {attachedDocumentIds.length} document{attachedDocumentIds.length !== 1 ? "s" : ""} attached
              </p>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <Link href="/dashboard/teacher/assignments">Cancel</Link>
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSave || updateAssignment.isPending || isSaving}
          >
            {updateAssignment.isPending || isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
