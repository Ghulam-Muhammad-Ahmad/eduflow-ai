import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useClassrooms, useClassroomRoster } from "@/hooks/useClassrooms";
import { useAssignments } from "@/hooks/useAssignments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  ArrowLeft,
  Users,
  Search,
  UserMinus,
  BookOpen,
  ClipboardList,
  FileText,
  ScrollText,
  Video,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TeacherClassroomDetail = () => {
  const router = useRouter();
  const { classroomId } = router.query as { classroomId: string };
  const { classrooms, isLoading: classroomsLoading, removeStudent } = useClassrooms();
  const { data: roster, isLoading: rosterLoading } = useClassroomRoster(classroomId || null);
  const { assignments } = useAssignments(classroomId);
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [removeStudentDialogOpen, setRemoveStudentDialogOpen] = useState(false);
  const [studentToRemove, setStudentToRemove] = useState<{ enrollmentId: string; name: string } | null>(null);

  const classroom = classrooms?.find((c) => c.id === classroomId);

  if (!classroom && !rosterLoading && !classroomsLoading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-16">
          <BookOpen className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Classroom Not Found</h2>
          <p className="text-muted-foreground mb-6">
            This classroom doesn&apos;t exist or you don&apos;t have access to it.
          </p>
          <Button onClick={() => router.push("/dashboard/teacher/classrooms")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Classrooms
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const handleRemoveStudent = (enrollmentId: string, studentName: string) => {
    setStudentToRemove({ enrollmentId, name: studentName });
    setRemoveStudentDialogOpen(true);
  };

  const confirmRemoveStudent = async () => {
    if (!studentToRemove || !classroomId) return;

    try {
      await removeStudent.mutateAsync({
        enrollmentId: studentToRemove.enrollmentId,
        classroomId: classroomId,
      });

      setRemoveStudentDialogOpen(false);
      setStudentToRemove(null);
    } catch (error: unknown) {
      toast({
        title: "Remove failed",
        description: error instanceof Error ? error.message : "Unable to remove student. Please try again.",
        variant: "destructive",
      });
    }
  };

  type ProfileLike = { display_name?: string; email?: string; avatar_url?: string };
  // Filter students based on search query
  const filteredRoster = roster?.filter((enrollment) => {
    const studentName = (enrollment.profiles as ProfileLike | null)?.display_name || "Student";
    const studentEmail = (enrollment.profiles as ProfileLike | null)?.email || "";
    const query = searchQuery.toLowerCase();
    return studentName.toLowerCase().includes(query) || studentEmail.toLowerCase().includes(query);
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/dashboard/teacher/classrooms")}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl lg:text-3xl font-bold">{classroom?.name}</h1>
              {classroom?.subject && (
                <p className="text-muted-foreground mt-1">{classroom.subject}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button asChild variant="outline" className="gap-2">
              <Link href={classroomId ? `/dashboard/teacher/sessions?classroomId=${classroomId}` : "/dashboard/teacher/sessions"}>
                <Video className="w-4 h-4" />
                View sessions
              </Link>
            </Button>
            <Button
              onClick={() => router.push(`/dashboard/teacher/student-records?classroomId=${classroomId}`)}
              className="gap-2"
            >
              <FileText className="w-4 h-4" />
              View classroom reports
            </Button>
          </div>
        </div>

        {/* Classroom Info Cards */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Students Count Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="w-4 h-4" />
                Total Students
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{roster?.length || 0}</div>
            </CardContent>
          </Card>

          {/* Assignments Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ClipboardList className="w-4 h-4" />
                Assignments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{assignments?.length || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Students Roster */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Enrolled Students</CardTitle>
                <CardDescription>
                  {filteredRoster?.length || 0} student{filteredRoster?.length !== 1 ? 's' : ''} enrolled
                </CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search students..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {rosterLoading && (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-4 rounded-lg border animate-pulse">
                    <div className="w-10 h-10 bg-secondary rounded-full shrink-0" />
                    <div className="flex-1">
                      <div className="h-4 bg-secondary rounded w-32 mb-2" />
                      <div className="h-3 bg-secondary rounded w-24" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!rosterLoading && (!filteredRoster || filteredRoster.length === 0) && !searchQuery && (
              <div className="text-center py-12 px-6">
                <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No students enrolled yet</h3>
                <p className="text-muted-foreground mb-4">
                  Students are added to this class by your workspace owner.
                </p>
              </div>
            )}

            {!rosterLoading && (!filteredRoster || filteredRoster.length === 0) && searchQuery && (
              <div className="text-center py-12 px-6">
                <Search className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No students found</h3>
                <p className="text-muted-foreground">
                  No students match your search query &quot;{searchQuery}&quot;
                </p>
              </div>
            )}

            {!rosterLoading && filteredRoster && filteredRoster.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/80 bg-muted/30">
                      <th className="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Student
                      </th>
                      <th className="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Email
                      </th>
                      <th className="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground hidden sm:table-cell">
                        Joined
                      </th>
                      <th className="px-6 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredRoster.map((enrollment) => {
                      const studentName = (enrollment.profiles as ProfileLike | null)?.display_name || "Student";
                      const studentEmail = (enrollment.profiles as ProfileLike | null)?.email || "—";
                      const avatarUrl = (enrollment.profiles as ProfileLike | null)?.avatar_url;
                      return (
                        <tr key={enrollment.id} className="hover:bg-muted/30 transition-colors group">
                          <td className="px-6 py-3.5">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9 shrink-0">
                                <AvatarImage src={avatarUrl} />
                                <AvatarFallback className="text-sm">
                                  {(studentName[0] || "S").toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium truncate">{studentName}</span>
                            </div>
                          </td>
                          <td className="px-6 py-3.5 text-muted-foreground truncate max-w-[200px]">
                            {studentEmail}
                          </td>
                          <td className="px-6 py-3.5 text-muted-foreground text-xs hidden sm:table-cell">
                            {new Date(enrollment.joined_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 shrink-0"
                                onClick={() => router.push(`/dashboard/teacher/student-records/${enrollment.student_id}?classroomId=${classroomId}`)}
                              >
                                <ScrollText className="w-4 h-4" />
                                View record
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleRemoveStudent(enrollment.id, studentName)}
                              >
                                <UserMinus className="w-4 h-4" />
                              </Button>
                            </div>
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

        {/* Remove Student Confirmation Dialog */}
        <AlertDialog open={removeStudentDialogOpen} onOpenChange={setRemoveStudentDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Student</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove <span className="font-semibold">{studentToRemove?.name}</span> from this classroom? 
                They will lose access to all classroom materials and assignments. 
                Contact your workspace owner to be re-added to the class.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setStudentToRemove(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmRemoveStudent}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={removeStudent.isPending}
              >
                {removeStudent.isPending ? "Removing..." : "Remove Student"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default TeacherClassroomDetail;
