import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Card, CardContent } from "@/components/ui/card";
import { School, Plus, Users, BookOpen, UserCircle, Search, Eye } from "lucide-react";
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
  const [primaryTutorId, setPrimaryTutorId] = useState<string>("");
  const [additionalTutorIds, setAdditionalTutorIds] = useState<string[]>([]);

  const tutorMap = new Map(tutors.map((t) => [t.user_id, t.profile?.display_name ?? t.profile?.email ?? "Tutor"]));
  const classroomIds = classrooms.map((c) => c.id);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredClassrooms = useMemo(() => {
    if (!searchQuery.trim()) return classrooms;
    const q = searchQuery.toLowerCase().trim();
    const map = new Map(tutors.map((t) => [t.user_id, t.profile?.display_name ?? t.profile?.email ?? "Tutor"]));
    return classrooms.filter((c) => {
      const name = (c.name ?? "").toLowerCase();
      const subject = (c.subject ?? "").toLowerCase();
      const primaryName = (map.get(c.teacher_id) ?? "").toLowerCase();
      return name.includes(q) || subject.includes(q) || primaryName.includes(q);
    });
  }, [classrooms, searchQuery, tutors]);

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
        teacher_id: primaryTutorId,
        additionalTutorIds: additionalTutorIds.filter((id) => id !== primaryTutorId),
      });
      toast({ title: "Class created", description: "You can add students from the class detail page." });
      setName("");
      setSubject("");
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
          <p className="text-muted-foreground">Loading...</p>
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

        {/* Classrooms table */}
        {!isLoading && classrooms.length > 0 && (
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden />
                <Input
                  type="search"
                  placeholder="Search by class name, subject, or tutor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  aria-label="Search classes"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/80 bg-muted/30">
                    <th className="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Class
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground hidden sm:table-cell">
                      Subject
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Primary tutor
                    </th>
                    <th className="px-6 py-3.5 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground w-24">
                      Students
                    </th>
                    <th className="px-6 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground w-24">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredClassrooms.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-sm text-muted-foreground">
                        No classes match &quot;{searchQuery}&quot;. Try a different search.
                      </td>
                    </tr>
                  ) : filteredClassrooms.map((c) => {
                    const tutorIds = tutorsByClassroomId.get(c.id) ?? [c.teacher_id];
                    const primaryName = tutorMap.get(c.teacher_id) ?? "Tutor";
                    const others = tutorIds.filter((id) => id !== c.teacher_id);
                    const studentCount = enrollmentCounts[c.id] ?? 0;
                    return (
                      <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-3.5">
                          <Link
                            href={`/dashboard/owner/classrooms/${c.id}`}
                            className="font-medium text-foreground hover:text-primary transition-colors"
                          >
                            {c.name}
                          </Link>
                          {c.subject && (
                            <p className="text-muted-foreground text-xs sm:hidden mt-0.5">{c.subject}</p>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-muted-foreground hidden sm:table-cell">
                          {c.subject ?? "—"}
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <UserCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            {primaryName}
                            {others.length > 0 && (
                              <span className="text-xs">+{others.length}</span>
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          <Link
                            href={`/dashboard/owner/classrooms/${c.id}`}
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                          >
                            <Users className="h-4 w-4 shrink-0" aria-hidden />
                            {studentCount}
                          </Link>
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <Button variant="default" size="sm" asChild>
                            <Link
                              href={`/dashboard/owner/classrooms/${c.id}`}
                              className="inline-flex items-center gap-2"
                              aria-label={`View ${c.name}`}
                            >
                              <Eye className="h-4 w-4" />
                              View
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
