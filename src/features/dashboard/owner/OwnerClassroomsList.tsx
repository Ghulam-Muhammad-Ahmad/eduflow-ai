import { useState } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { School, Plus, Users, BookOpen, MoreVertical, ArrowRight, UserCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function OwnerClassroomsList() {
  const router = useRouter();
  const {
    workspace,
    classrooms,
    tutors,
    tutorsByClassroomId,
    createClassroom,
    isLoading,
  } = useOwnerWorkspace();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [primaryTutorId, setPrimaryTutorId] = useState<string>("");
  const [additionalTutorIds, setAdditionalTutorIds] = useState<string[]>([]);

  const tutorMap = new Map(tutors.map((t) => [t.user_id, t.profile?.display_name ?? t.profile?.email ?? "Tutor"]));
  const classroomIds = classrooms.map((c) => c.id);

  const { data: enrollmentCounts = {} } = useQuery({
    queryKey: ["owner-classroom-enrollment-counts", classroomIds],
    queryFn: async (): Promise<Record<string, number>> => {
      if (classroomIds.length === 0) return {};
      const { data, error } = await supabase
        .from("enrollments")
        .select("classroom_id")
        .in("classroom_id", classroomIds)
        .eq("status", "active");
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        counts[row.classroom_id] = (counts[row.classroom_id] ?? 0) + 1;
      }
      return counts;
    },
    enabled: classroomIds.length > 0,
  });

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({
        title: "Class name required",
        description: "Please enter a classroom name.",
        variant: "destructive",
      });
      return;
    }
    if (!primaryTutorId) {
      toast({
        title: "Select a tutor",
        description: "Please assign at least one tutor as primary.",
        variant: "destructive",
      });
      return;
    }
    try {
      await createClassroom.mutateAsync({
        name: name.trim(),
        subject: subject.trim() || null,
        description: description.trim() || null,
        teacher_id: primaryTutorId,
        additionalTutorIds: additionalTutorIds.filter((id) => id !== primaryTutorId),
      });
      toast({ title: "Class created", description: "You can add students from the class detail page." });
      setName("");
      setSubject("");
      setDescription("");
      setPrimaryTutorId("");
      setAdditionalTutorIds([]);
      setCreateOpen(false);
    } catch (e) {
      toast({
        title: "Failed to create class",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Classes</h1>
            <p className="text-muted-foreground mt-1">
              {workspace?.name ?? "Workspace"} · Create and manage classrooms
            </p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Create class
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create class</DialogTitle>
                <DialogDescription>
                  Create a new classroom and assign one or more tutors. You can add students from the class page.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Class name *</Label>
                  <Input
                    placeholder="e.g. AP Calculus - Period 3"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Input
                    placeholder="e.g. Mathematics"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    placeholder="Brief description..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Primary tutor *</Label>
                  <Select value={primaryTutorId} onValueChange={setPrimaryTutorId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select tutor" />
                    </SelectTrigger>
                    <SelectContent>
                      {tutors.map((t) => (
                        <SelectItem key={t.user_id} value={t.user_id}>
                          {t.profile?.display_name ?? t.profile?.email ?? t.user_id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {tutors.length > 1 && (
                  <div className="space-y-2">
                    <Label>Additional tutors (optional)</Label>
                    <Select
                      value=""
                      onValueChange={(id) => {
                        if (id && !additionalTutorIds.includes(id)) {
                          setAdditionalTutorIds([...additionalTutorIds, id]);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Add another tutor" />
                      </SelectTrigger>
                      <SelectContent>
                        {tutors
                          .filter((t) => t.user_id !== primaryTutorId && !additionalTutorIds.includes(t.user_id))
                          .map((t) => (
                            <SelectItem key={t.user_id} value={t.user_id}>
                              {t.profile?.display_name ?? t.profile?.email ?? t.user_id}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {additionalTutorIds.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {additionalTutorIds.map((id) => (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-sm"
                          >
                            {tutorMap.get(id) ?? id}
                            <button
                              type="button"
                              className="ml-1 hover:text-destructive"
                              onClick={() => setAdditionalTutorIds(additionalTutorIds.filter((x) => x !== id))}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!name.trim() || !primaryTutorId || createClassroom.isPending}
                >
                  {createClassroom.isPending ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-secondary rounded w-3/4" />
                  <div className="h-4 bg-secondary rounded w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <div className="h-20 bg-secondary rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && classrooms.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="feature-icon-indigo mb-4">
                <School className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No classrooms yet</h3>
              <p className="text-muted-foreground text-center mb-6 max-w-sm">
                Create a class, assign tutors, then add students from the class page.
              </p>
              <Button className="gap-2" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                Create your first class
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Classrooms grid (tutor-style cards) */}
        {!isLoading && classrooms.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {classrooms.map((c) => {
              const tutorIds = tutorsByClassroomId.get(c.id) ?? [c.teacher_id];
              const primaryName = tutorMap.get(c.teacher_id) ?? "Tutor";
              const others = tutorIds.filter((id) => id !== c.teacher_id);
              const studentCount = enrollmentCounts[c.id] ?? 0;

              return (
                <Card
                  key={c.id}
                  className="group hover:shadow-lg transition-shadow"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">
                          {c.name}
                        </CardTitle>
                        {c.subject && (
                          <CardDescription className="truncate">
                            {c.subject}
                          </CardDescription>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/dashboard/owner/classrooms/${c.id}`)}>
                            <BookOpen className="w-4 h-4 mr-2" />
                            Manage class
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/dashboard/owner/classrooms/${c.id}`)}>
                            <Users className="w-4 h-4 mr-2" />
                            View roster
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <UserCircle className="h-4 w-4" />
                        {primaryName}
                        {others.length > 0 && (
                          <span className="text-xs">+{others.length}</span>
                        )}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Users className="h-4 w-4" />
                        {studentCount} student{studentCount !== 1 ? "s" : ""}
                      </span>
                    </div>

                    <Button
                      className="w-full gap-2"
                      onClick={() => router.push(`/dashboard/owner/classrooms/${c.id}`)}
                    >
                      <BookOpen className="h-4 w-4" />
                      Manage class
                      <ArrowRight className="h-4 w-4 ml-auto" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
