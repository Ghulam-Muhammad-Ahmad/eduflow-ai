import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useClassroomRoster } from "@/hooks/useClassrooms";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowLeft,
  Users,
  UserPlus,
  UserMinus,
  BookOpen,
  ClipboardList,
  Search,
  Video,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ProfileLike = { display_name?: string | null; email?: string | null; avatar_url?: string | null };

export default function OwnerClassroomDetail() {
  const router = useRouter();
  const { id } = router.query as { id: string };
  const {
    classrooms,
    tutors,
    tutorsByClassroomId,
    assignedStudents,
    updateClassroomTutors,
    addStudentToClassroom,
    isLoading: workspaceLoading,
  } = useOwnerWorkspace();
  const queryClient = useQueryClient();
  const { data: roster = [], isLoading: rosterLoading } = useClassroomRoster(id || null);
  const { toast } = useToast();

  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [removeStudentOpen, setRemoveStudentOpen] = useState(false);
  const [studentToRemove, setStudentToRemove] = useState<{ enrollmentId: string; name: string } | null>(null);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [newPrimaryTutorId, setNewPrimaryTutorId] = useState("");
  const [addTutorOpen, setAddTutorOpen] = useState(false);
  const [addTutorId, setAddTutorId] = useState("");
  const [removeTutorOpen, setRemoveTutorOpen] = useState(false);
  const [removeTutorId, setRemoveTutorId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const classroom = classrooms.find((c) => c.id === id);
  const tutorIds = id ? (tutorsByClassroomId.get(id) ?? (classroom ? [classroom.teacher_id] : [])) : [];
  const tutorMap = new Map(tutors.map((t) => [t.user_id, t.profile?.display_name ?? t.profile?.email ?? "Tutor"]));

  const enrolledStudentIds = new Set(roster.map((r) => r.student_id));
  const studentsNotInClass = assignedStudents.filter(
    (s) => !enrolledStudentIds.has((s as { student_id: string }).student_id)
  ) as { student_id: string; student?: { display_name?: string | null; email?: string | null } }[];

  const filteredRoster = roster.filter((r) => {
    const p = (r as { profiles?: ProfileLike }).profiles;
    const name = p?.display_name ?? "";
    const email = p?.email ?? "";
    const q = searchQuery.toLowerCase();
    return !q || name.toLowerCase().includes(q) || email.toLowerCase().includes(q);
  });

  const handleAddStudent = async () => {
    if (!id || !selectedStudentId) return;
    try {
      await addStudentToClassroom.mutateAsync({ classroomId: id, studentId: selectedStudentId });
      toast({ title: "Student added", description: "They can now see this class." });
      setSelectedStudentId("");
      setAddStudentOpen(false);
    } catch (e) {
      toast({
        title: "Failed to add student",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "destructive",
      });
    }
  };

  const handleRemoveStudent = (enrollmentId: string, name: string) => {
    setStudentToRemove({ enrollmentId, name });
    setRemoveStudentOpen(true);
  };

  const confirmRemoveStudent = async () => {
    if (!studentToRemove || !id) return;
    const { error } = await supabase
      .from("enrollments")
      .update({ status: "removed", left_at: new Date().toISOString() })
      .eq("id", studentToRemove.enrollmentId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Student removed", description: "They no longer have access to this class." });
    setRemoveStudentOpen(false);
    setStudentToRemove(null);
    queryClient.invalidateQueries({ queryKey: ["classroom-roster", id] });
  };

  const handleReassignPrimary = async () => {
    if (!id || !newPrimaryTutorId) return;
    try {
      await updateClassroomTutors.mutateAsync({
        classroomId: id,
        teacher_id: newPrimaryTutorId,
        addTutorIds: [newPrimaryTutorId],
      });
      toast({ title: "Primary tutor updated" });
      setNewPrimaryTutorId("");
      setReassignOpen(false);
    } catch (e) {
      toast({
        title: "Failed to update",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "destructive",
      });
    }
  };

  const handleAddTutor = async () => {
    if (!id || !addTutorId) return;
    try {
      await updateClassroomTutors.mutateAsync({
        classroomId: id,
        addTutorIds: [addTutorId],
      });
      toast({ title: "Tutor added to class" });
      setAddTutorId("");
      setAddTutorOpen(false);
    } catch (e) {
      toast({
        title: "Failed to add tutor",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "destructive",
      });
    }
  };

  const handleRemoveTutor = async () => {
    if (!id || !removeTutorId || !classroom) return;
    const remaining = tutorIds.filter((uid) => uid !== removeTutorId);
    if (remaining.length === 0) {
      toast({
        title: "Cannot remove last tutor",
        description: "Assign a new primary tutor first.",
        variant: "destructive",
      });
      return;
    }
    const newPrimary = removeTutorId === classroom.teacher_id ? remaining[0]! : undefined;
    try {
      await updateClassroomTutors.mutateAsync({
        classroomId: id,
        ...(newPrimary && { teacher_id: newPrimary }),
        removeTutorIds: [removeTutorId],
      });
      toast({ title: "Tutor removed from class" });
      setRemoveTutorId("");
      setRemoveTutorOpen(false);
    } catch (e) {
      toast({
        title: "Failed to remove tutor",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "destructive",
      });
    }
  };

  if (!classroom && !workspaceLoading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-16">
          <BookOpen className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Class not found</h2>
          <p className="text-muted-foreground mb-6">This class doesn&apos;t exist or you don&apos;t have access.</p>
          <Button asChild>
            <Link href="/dashboard/owner/classrooms">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Classes
            </Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/dashboard/owner/classrooms">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold truncate">{classroom?.name}</h1>
              {classroom?.subject && (
                <p className="text-muted-foreground">{classroom.subject}</p>
              )}
            </div>
          </div>
          {id && (
            <Button asChild variant="outline" className="gap-2 shrink-0">
              <Link href={`/dashboard/owner/sessions?classroomId=${id}`}>
                <Video className="h-4 w-4" />
                View sessions
              </Link>
            </Button>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Assigned tutors
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {tutorIds.map((uid) => (
                <div key={uid} className="flex items-center justify-between gap-2">
                  <span className="text-sm">
                    {tutorMap.get(uid)} {uid === classroom?.teacher_id && "(primary)"}
                  </span>
                  {tutorIds.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        setRemoveTutorId(uid);
                        setRemoveTutorOpen(true);
                      }}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setReassignOpen(true)}>
                  Set primary
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAddTutorOpen(true)}>
                  Add tutor
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Students
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{roster.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                About
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground line-clamp-3">
                {classroom?.description || "No description."}
              </p>
            </CardContent>
          </Card>
        </div>

        {classroom?.description && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{classroom.description}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle>Roster</CardTitle>
                <CardDescription>
                  {filteredRoster.length} student{filteredRoster.length !== 1 ? "s" : ""} enrolled
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Dialog open={addStudentOpen} onOpenChange={setAddStudentOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1">
                      <UserPlus className="h-4 w-4" />
                      Add student
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add student to class</DialogTitle>
                      <DialogDescription>
                        Choose a student who is in your workspace and not yet in this class.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <Label>Student</Label>
                      <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                        <SelectTrigger className="mt-2">
                          <SelectValue placeholder="Select student" />
                        </SelectTrigger>
                        <SelectContent>
                          {studentsNotInClass.map((s) => (
                            <SelectItem key={s.student_id} value={s.student_id}>
                              {s.student?.display_name ?? s.student?.email ?? s.student_id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {studentsNotInClass.length === 0 && (
                        <p className="text-sm text-muted-foreground mt-2">
                          All workspace students are already in this class, or no students are assigned yet.
                        </p>
                      )}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setAddStudentOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={handleAddStudent}
                        disabled={!selectedStudentId || addStudentToClassroom.isPending}
                      >
                        {addStudentToClassroom.isPending ? "Adding..." : "Add"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {rosterLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 rounded-lg border bg-secondary/30 animate-pulse" />
                ))}
              </div>
            ) : filteredRoster.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {searchQuery ? "No students match your search." : "No students enrolled yet. Add students above."}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredRoster.map((enrollment) => {
                  const p = (enrollment as { profiles?: ProfileLike }).profiles;
                  const name = p?.display_name ?? "Student";
                  const email = p?.email ?? "";
                  return (
                    <div
                      key={enrollment.id}
                      className="flex items-center gap-4 p-4 rounded-lg border hover:bg-secondary/30"
                    >
                      <Avatar className="h-10 w-10">
                      <AvatarImage src={p?.avatar_url ?? undefined} />
                        <AvatarFallback>{(name[0] || "S").toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{name}</p>
                        <p className="text-sm text-muted-foreground truncate">{email}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleRemoveStudent(enrollment.id, name)}
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={removeStudentOpen} onOpenChange={setRemoveStudentOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove student</AlertDialogTitle>
              <AlertDialogDescription>
                Remove {studentToRemove?.name} from this class? They will lose access. You can add them again later.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setStudentToRemove(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmRemoveStudent} className="bg-destructive text-destructive-foreground">
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set primary tutor</DialogTitle>
              <DialogDescription>Choose who is the primary tutor for this class.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Select value={newPrimaryTutorId} onValueChange={setNewPrimaryTutorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select tutor" />
                </SelectTrigger>
                <SelectContent>
                  {tutorIds.map((uid) => (
                    <SelectItem key={uid} value={uid}>
                      {tutorMap.get(uid)} {uid === classroom?.teacher_id && "(current primary)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReassignOpen(false)}>Cancel</Button>
              <Button onClick={handleReassignPrimary} disabled={!newPrimaryTutorId}>
                Update
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={addTutorOpen} onOpenChange={setAddTutorOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add tutor to class</DialogTitle>
              <DialogDescription>Select a workspace tutor to add to this class.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Select value={addTutorId} onValueChange={setAddTutorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select tutor" />
                </SelectTrigger>
                <SelectContent>
                  {tutors
                    .filter((t) => !tutorIds.includes(t.user_id))
                    .map((t) => (
                      <SelectItem key={t.user_id} value={t.user_id}>
                        {t.profile?.display_name ?? t.profile?.email ?? t.user_id}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddTutorOpen(false)}>Cancel</Button>
              <Button onClick={handleAddTutor} disabled={!addTutorId}>Add</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={removeTutorOpen} onOpenChange={setRemoveTutorOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove tutor from class</AlertDialogTitle>
              <AlertDialogDescription>
                Remove {tutorMap.get(removeTutorId)} from this class? They will no longer see it. If they are primary, another tutor will be set as primary.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setRemoveTutorId("")}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleRemoveTutor}>Remove</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
