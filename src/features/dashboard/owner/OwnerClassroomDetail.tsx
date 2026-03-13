import { useState, useMemo } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useClassroomRoster } from "@/hooks/useClassrooms";
import { useClassroomLectureSessions } from "@/hooks/useLectureSessions";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowLeft,
  UserPlus,
  UserMinus,
  BookOpen,
  Search,
  Video,
  MoreVertical,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { format, startOfWeek, subWeeks } from "date-fns";
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
    assignments: workspaceAssignments,
    quizzes: workspaceQuizzes,
    documents: workspaceDocuments,
    updateClassroomTutors,
    addStudentToClassroom,
    isLoading: workspaceLoading,
  } = useOwnerWorkspace();
  const queryClient = useQueryClient();
  const { data: roster = [], isLoading: rosterLoading } = useClassroomRoster(id || null);
  const { data: classSessions = [] } = useClassroomLectureSessions(id || null);
  const { toast } = useToast();

  const classroom = classrooms.find((c) => c.id === id);
  const tutorIds = id ? (tutorsByClassroomId.get(id) ?? (classroom ? [classroom.teacher_id] : [])) : [];

  const classAssignmentIds = useMemo(
    () => (id ? workspaceAssignments.filter((a) => (a as { classroom_id?: string }).classroom_id === id).map((a) => a.id) : []),
    [id, workspaceAssignments]
  );
  const classQuizIds = useMemo(
    () => (id ? workspaceQuizzes.filter((q) => (q as { classroom_id?: string }).classroom_id === id).map((q) => q.id) : []),
    [id, workspaceQuizzes]
  );

  const { data: classSubmissions = [] } = useQuery({
    queryKey: ["classroom-submissions", id, classAssignmentIds],
    queryFn: async () => {
      if (!id || classAssignmentIds.length === 0) return [];
      const { data, error } = await supabase
        .from("submissions")
        .select("id, submitted_at")
        .in("assignment_id", classAssignmentIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id && classAssignmentIds.length > 0,
  });

  const { data: classQuizAttempts = [] } = useQuery({
    queryKey: ["classroom-quiz-attempts", id, classQuizIds],
    queryFn: async () => {
      if (!id || classQuizIds.length === 0) return [];
      const { data, error } = await supabase
        .from("quiz_attempts")
        .select("id, submitted_at")
        .in("quiz_id", classQuizIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id && classQuizIds.length > 0,
  });

  const activityTimeline = useMemo(() => {
    const weeks: { week: string; sessions: number; submissions: number; quizzes: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const sessionsCount = classSessions.filter((s) => {
        const d = s.status === "completed" ? new Date((s as { ends_at?: string }).ends_at ?? s.starts_at) : new Date(s.starts_at);
        return d >= weekStart && d < weekEnd;
      }).length;
      const submissionsCount = classSubmissions.filter((s) => {
        const d = new Date((s as { submitted_at: string }).submitted_at);
        return d >= weekStart && d < weekEnd;
      }).length;
      const quizzesCount = classQuizAttempts.filter((q) => {
        const subAt = (q as { submitted_at?: string | null }).submitted_at;
        if (!subAt) return false;
        const d = new Date(subAt);
        return d >= weekStart && d < weekEnd;
      }).length;
      weeks.push({
        week: format(weekStart, "d MMM"),
        sessions: sessionsCount,
        submissions: submissionsCount,
        quizzes: quizzesCount,
      });
    }
    return weeks;
  }, [classSessions, classSubmissions, classQuizAttempts]);

  const classAssignments = useMemo(
    () => (id ? workspaceAssignments.filter((a) => (a as { classroom_id?: string }).classroom_id === id) : []),
    [id, workspaceAssignments]
  );
  const classQuizzes = useMemo(
    () => (id ? workspaceQuizzes.filter((q) => (q as { classroom_id?: string }).classroom_id === id) : []),
    [id, workspaceQuizzes]
  );
  const classMemberIds = useMemo(
    () => new Set([...tutorIds, ...roster.map((r) => r.student_id)]),
    [tutorIds, roster]
  );
  const classDocuments = useMemo(
    () => workspaceDocuments.filter((d) => classMemberIds.has(d.user_id)),
    [workspaceDocuments, classMemberIds]
  );

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

        <div className="grid md:grid-cols-2 gap-4">
          {/* Assigned tutors */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Assigned tutors</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setAddTutorOpen(true)}>
                  Add tutor
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {tutorIds.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No tutors assigned. Add a workspace tutor to teach this class.</p>
              ) : (
                <>
                  {tutorIds.map((uid) => {
                    const tutor = tutors.find((t) => t.user_id === uid);
                    const name = tutorMap.get(uid) ?? "Tutor";
                    const isPrimary = uid === classroom?.teacher_id;
                    const hasMenuActions = !isPrimary || tutorIds.length > 1;
                    return (
                      <div key={uid} className="flex items-center justify-between gap-2 py-1.5">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={tutor?.profile?.avatar_url ?? undefined} />
                            <AvatarFallback className="text-xs">{(name[0] || "T").toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm truncate">
                            {name} {isPrimary && <span className="text-muted-foreground">(primary)</span>}
                          </span>
                        </div>
                        {hasMenuActions && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Tutor actions">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              {!isPrimary && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setNewPrimaryTutorId(uid);
                                    setReassignOpen(true);
                                  }}
                                >
                                  Set as primary
                                </DropdownMenuItem>
                              )}
                              {tutorIds.length > 1 && (
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => {
                                    setRemoveTutorId(uid);
                                    setRemoveTutorOpen(true);
                                  }}
                                >
                                  Remove from class
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </CardContent>
          </Card>

          {/* Students count */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{roster.length}</div>
            </CardContent>
          </Card>
        </div>

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
                    <Button size="sm">
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
          <CardContent className="p-0">
            {rosterLoading ? (
              <div className="px-6 py-4 space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 rounded-lg border bg-secondary/30 animate-pulse" />
                ))}
              </div>
            ) : filteredRoster.length === 0 ? (
              <div className="px-6 py-12 text-center text-muted-foreground">
                {searchQuery ? "No students match your search." : "No students enrolled yet. Add students above."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/80 bg-muted/30">
                      <th className="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Student
                      </th>
                      <th className="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground hidden sm:table-cell">
                        Email
                      </th>
                      <th className="px-6 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground w-24">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredRoster.map((enrollment) => {
                      const p = (enrollment as { profiles?: ProfileLike }).profiles;
                      const name = p?.display_name ?? "Student";
                      const email = p?.email ?? "";
                      return (
                        <tr key={enrollment.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-6 py-3.5">
                            <Link
                              href={`/dashboard/owner/students/${enrollment.student_id}`}
                              className="flex items-center gap-3 font-medium text-foreground hover:text-primary transition-colors"
                            >
                              <Avatar className="h-9 w-9 shrink-0">
                                <AvatarImage src={p?.avatar_url ?? undefined} />
                                <AvatarFallback>{(name[0] || "S").toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <span className="truncate">{name}</span>
                            </Link>
                            {email && (
                              <p className="text-muted-foreground text-xs sm:hidden mt-0.5 truncate pl-12">{email}</p>
                            )}
                          </td>
                          <td className="px-6 py-3.5 text-muted-foreground hidden sm:table-cell">
                            {email || "—"}
                          </td>
                          <td className="px-6 py-3.5 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-white gap-2 hover:bg-destructive"
                              onClick={() => handleRemoveStudent(enrollment.id, name)}
                            >
                              <UserMinus className="h-4 w-4" />
                              Remove
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Class overview: report, assignments, quizzes, activities, documents */}
        <section className="space-y-6" aria-labelledby="class-overview-heading">
          <h2 id="class-overview-heading" className="text-lg font-semibold tracking-tight text-foreground border-b border-border/60 pb-2">
            Class overview
          </h2>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Class report */}
            <Card>
             
                <CardHeader className="pb-3">
                  <CardTitle className="text-2xl font-semibold">Class report</CardTitle>
                  <CardDescription>
                    Student records, grades, and progress for this class
                  </CardDescription>
                </CardHeader>
            <CardContent>
              <Link
                href={id ? `/dashboard/owner/student-records?classroomId=${id}` : "#"}
                className="block"
              >
                <Button variant="default" className="w-fit">
                  View full student records
                </Button>
              </Link>
            </CardContent>
            </Card>

            {/* Assignments */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-2xl font-semibold">Assignments</CardTitle>
                <CardDescription>
                  {classAssignments.length} assignment{classAssignments.length !== 1 ? "s" : ""} in this class
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {classAssignments.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No assignments yet. Tutors can create them from the class.</p>
                ) : (
                  <ul className="space-y-2 max-h-40 overflow-y-auto">
                    {classAssignments.slice(0, 5).map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-2 text-sm py-1.5 border-b border-border/40 last:border-0">
                        <span className="font-medium truncate">{(a as { title?: string }).title ?? "Assignment"}</span>
                        <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${
                          (a as { status?: string }).status === "published"
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {(a as { status?: string }).status ?? "draft"}
                        </span>
                      </li>
                    ))}
                    {classAssignments.length > 5 && (
                      <li className="text-xs text-muted-foreground pt-1">{classAssignments.length - 5} more</li>
                    )}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Quizzes */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-2xl font-semibold">Quizzes</CardTitle>
                <CardDescription>
                  {classQuizzes.length} quiz{classQuizzes.length !== 1 ? "zes" : ""} in this class
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {classQuizzes.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No quizzes yet. Tutors can create them from the class.</p>
                ) : (
                  <ul className="space-y-2 max-h-40 overflow-y-auto">
                    {classQuizzes.slice(0, 5).map((q) => (
                      <li key={q.id} className="flex items-center justify-between gap-2 text-sm py-1.5 border-b border-border/40 last:border-0">
                        <span className="font-medium truncate">{(q as { title?: string }).title ?? "Quiz"}</span>
                        <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {(q as { status?: string }).status ?? "—"}
                        </span>
                      </li>
                    ))}
                    {classQuizzes.length > 5 && (
                      <li className="text-xs text-muted-foreground pt-1">{classQuizzes.length - 5} more</li>
                    )}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Documents shared */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-2xl font-semibold">Documents shared</CardTitle>
                <CardDescription>
                  Files shared by tutors and students in this class
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {classDocuments.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No documents yet from this class.</p>
                ) : (
                  <ul className="space-y-2 max-h-40 overflow-y-auto">
                    {classDocuments.slice(0, 5).map((d) => (
                      <li key={d.id} className="flex items-center justify-between gap-2 text-sm py-1.5 border-b border-border/40 last:border-0">
                        <span className="font-medium truncate">{d.name}</span>
                        {d.file_size != null && (
                          <span className="shrink-0 text-xs text-muted-foreground ml-auto">
                            {(d.file_size / 1024).toFixed(1)} KB
                          </span>
                        )}
                      </li>
                    ))}
                    {classDocuments.length > 5 && (
                      <li className="text-xs text-muted-foreground pt-1">{classDocuments.length - 5} more</li>
                    )}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Activities graph */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-2xl">Activities</CardTitle>
              <CardDescription>
                Sessions, submissions, and quiz attempts in the last 6 weeks
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {activityTimeline.length === 0 ? (
                <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/20">
                  <p className="text-sm text-muted-foreground">No activity data yet for this class.</p>
                </div>
              ) : (
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={activityTimeline} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" vertical={false} />
                      <XAxis
                        dataKey="week"
                        tick={{ fontSize: 12 }}
                        className="text-muted-foreground"
                        tickLine={false}
                        axisLine={{ stroke: "hsl(var(--border))" }}
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        className="text-muted-foreground"
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                        width={24}
                      />
                      <Tooltip
                        content={({ active, payload, label }) =>
                          active && payload?.length ? (
                            <div className="rounded-lg border border-border bg-card px-3 py-2.5 text-xs shadow-lg">
                              <p className="font-medium text-foreground mb-1.5">{label}</p>
                              <p className="text-muted-foreground">Sessions: {(payload.find((p) => p.dataKey === "sessions")?.value as number) ?? 0}</p>
                              <p className="text-muted-foreground">Submissions: {(payload.find((p) => p.dataKey === "submissions")?.value as number) ?? 0}</p>
                              <p className="text-muted-foreground">Quizzes: {(payload.find((p) => p.dataKey === "quizzes")?.value as number) ?? 0}</p>
                            </div>
                          ) : null
                        }
                      />
                      <Bar dataKey="sessions" name="Sessions" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} maxBarSize={36} />
                      <Bar dataKey="submissions" name="Submissions" fill="rgb(16, 185, 129)" radius={[2, 2, 0, 0]} maxBarSize={36} />
                      <Bar dataKey="quizzes" name="Quizzes" fill="rgb(59, 130, 246)" radius={[2, 2, 0, 0]} maxBarSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

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
