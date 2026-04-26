import { useState } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  useStudentRequirements,
  useCreateRequirement,
  useUpdateRequirement,
  useDeleteRequirement,
  type StudentRequirement,
} from "@/hooks/useTutorMatching";
import { Plus, Trash2, Users, ChevronRight, Pencil } from "lucide-react";

const STUDENT_LEVELS = ["beginner", "weak", "average", "advanced"];
const STUDENT_NATURES = ["shy", "hyperactive", "exam_pressure", "slow_learner", "motivated"];
const STATUS_CONFIG = {
  open: { label: "Open", variant: "secondary" as const },
  matched: { label: "Matched", variant: "default" as const },
  closed: { label: "Closed", variant: "outline" as const },
};

const DEFAULT_FORM = {
  student_name: "",
  subject: "",
  grade: "",
  curriculum: "",
  student_level: "" as StudentRequirement["student_level"] | "",
  student_nature: [] as string[],
  goal: "",
  preferred_teaching_style: "",
  language: "English",
  budget_hourly: "" as string | number,
  availability: "" as string,
};

export default function OwnerStudentRequirements() {
  const { data: requirements = [], isLoading } = useStudentRequirements();
  const createReq = useCreateRequirement();
  const updateReq = useUpdateRequirement();
  const deleteReq = useDeleteRequirement();
  const { toast } = useToast();
  const router = useRouter();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);

  const openCreate = () => {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  };

  const openEdit = (req: StudentRequirement) => {
    setEditingId(req.id);
    setForm({
      student_name: req.student_name,
      subject: req.subject,
      grade: req.grade,
      curriculum: req.curriculum,
      student_level: req.student_level ?? "",
      student_nature: req.student_nature ?? [],
      goal: req.goal ?? "",
      preferred_teaching_style: req.preferred_teaching_style ?? "",
      language: req.language,
      budget_hourly: req.budget_hourly ?? "",
      availability: (req.availability ?? []).join(", "),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.student_name || !form.subject || !form.grade || !form.curriculum) {
      toast({ title: "Fill required fields", variant: "destructive" });
      return;
    }

    const payload = {
      student_name: form.student_name,
      subject: form.subject,
      grade: form.grade,
      curriculum: form.curriculum,
      student_level: (form.student_level || null) as StudentRequirement["student_level"],
      student_nature: form.student_nature,
      goal: form.goal || null,
      preferred_teaching_style: form.preferred_teaching_style || null,
      language: form.language || "English",
      budget_hourly: form.budget_hourly ? Number(form.budget_hourly) : null,
      availability: form.availability
        ? form.availability.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
      student_id: null,
      classroom_id: null,
      requirement_type: "student" as const,
    };

    try {
      if (editingId) {
        await updateReq.mutateAsync({ id: editingId, ...payload });
        toast({ title: "Requirement updated" });
      } else {
        await createReq.mutateAsync(payload);
        toast({ title: "Requirement created" });
      }
      setDialogOpen(false);
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteReq.mutateAsync(id);
      toast({ title: "Requirement deleted" });
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    }
  };

  const toggleNature = (n: string) => {
    setForm((f) => ({
      ...f,
      student_nature: f.student_nature.includes(n)
        ? f.student_nature.filter((x) => x !== n)
        : [...f.student_nature, n],
    }));
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Student Requirements</h1>
            <p className="text-muted-foreground mt-1">
              Define what you need for each student to find the best tutor match.
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" /> New Requirement
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : requirements.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-16 gap-4">
              <Users className="w-12 h-12 text-muted-foreground" />
              <p className="text-lg font-medium">No requirements yet</p>
              <p className="text-muted-foreground text-sm">
                Create a student requirement to start matching tutors.
              </p>
              <Button onClick={openCreate}>
                <Plus className="w-4 h-4 mr-2" /> New Requirement
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {requirements.map((req) => (
              <Card key={req.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{req.student_name}</span>
                      <Badge variant={STATUS_CONFIG[req.status]?.variant ?? "secondary"}>
                        {STATUS_CONFIG[req.status]?.label ?? req.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {req.subject} &middot; Grade {req.grade} &middot; {req.curriculum}
                      {req.student_level && ` &middot; ${req.student_level}`}
                    </p>
                    {req.goal && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">{req.goal}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => openEdit(req)}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/dashboard/owner/tutor-matching?requirement=${req.id}`)}
                    >
                      Find Tutor <ChevronRight className="w-3 h-3 ml-1" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(req.id)}
                      disabled={deleteReq.isPending}
                    >
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Requirement" : "New Student Requirement"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1">
                <Label>Student Name *</Label>
                <Input
                  value={form.student_name}
                  onChange={(e) => setForm((f) => ({ ...f, student_name: e.target.value }))}
                  placeholder="e.g. Ali"
                />
              </div>
              <div className="space-y-1">
                <Label>Subject *</Label>
                <Input
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  placeholder="e.g. Math"
                />
              </div>
              <div className="space-y-1">
                <Label>Grade *</Label>
                <Input
                  value={form.grade}
                  onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))}
                  placeholder="e.g. Grade 7"
                />
              </div>
              <div className="space-y-1">
                <Label>Curriculum *</Label>
                <Input
                  value={form.curriculum}
                  onChange={(e) => setForm((f) => ({ ...f, curriculum: e.target.value }))}
                  placeholder="e.g. Cambridge"
                />
              </div>
              <div className="space-y-1">
                <Label>Student Level</Label>
                <Select
                  value={form.student_level || ""}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, student_level: v as StudentRequirement["student_level"] }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    {STUDENT_LEVELS.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l.charAt(0).toUpperCase() + l.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Student Nature</Label>
              <div className="flex flex-wrap gap-2">
                {STUDENT_NATURES.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => toggleNature(n)}
                    className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                      form.student_nature.includes(n)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label>Goal</Label>
              <Textarea
                value={form.goal}
                onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))}
                placeholder="e.g. Improve basics and prepare for exams"
                rows={2}
              />
            </div>

            <div className="space-y-1">
              <Label>Preferred Teaching Style</Label>
              <Input
                value={form.preferred_teaching_style}
                onChange={(e) => setForm((f) => ({ ...f, preferred_teaching_style: e.target.value }))}
                placeholder="e.g. Conceptual and slow-paced"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Language</Label>
                <Input
                  value={form.language}
                  onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
                  placeholder="English"
                />
              </div>
              <div className="space-y-1">
                <Label>Budget (hourly)</Label>
                <Input
                  type="number"
                  value={form.budget_hourly}
                  onChange={(e) => setForm((f) => ({ ...f, budget_hourly: e.target.value }))}
                  placeholder="e.g. 30"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Availability (comma-separated)</Label>
              <Input
                value={form.availability}
                onChange={(e) => setForm((f) => ({ ...f, availability: e.target.value }))}
                placeholder="e.g. Monday 6PM, Wednesday 5PM"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={createReq.isPending || updateReq.isPending}
            >
              {(createReq.isPending || updateReq.isPending) && (
                <Spinner className="mr-2 h-4 w-4" />
              )}
              {editingId ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
