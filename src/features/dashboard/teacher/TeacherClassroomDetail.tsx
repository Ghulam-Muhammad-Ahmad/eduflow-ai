import { useState } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useClassrooms, useClassroomRoster } from "@/hooks/useClassrooms";
import { useAssignments } from "@/hooks/useAssignments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
  Copy,
  Check,
  Search,
  UserMinus,
  BookOpen,
  ClipboardList,
  FileText,
  ScrollText,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TeacherClassroomDetail = () => {
  const router = useRouter();
  const { classroomId } = router.query as { classroomId: string };
  const { classrooms, isLoading: classroomsLoading, removeStudent } = useClassrooms();
  const { data: roster, isLoading: rosterLoading } = useClassroomRoster(classroomId || null);
  const { assignments } = useAssignments(classroomId);
  const { toast } = useToast();

  const [copiedCode, setCopiedCode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedInvite, setCopiedInvite] = useState(false);
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

  const copyJoinCode = async (code: string) => {
    if (!navigator?.clipboard?.writeText) {
      setCopiedCode(false);
      toast({
        title: "Copy failed",
        description: "Clipboard not supported. Please copy the code manually.",
        variant: "destructive",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      toast({
        title: "Code copied!",
        description: "Share this code with your students.",
      });
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (error) {
      console.error("Failed to copy join code:", error);
      setCopiedCode(false);
      toast({
        title: "Copy failed",
        description: "Unable to copy the code. Please copy it manually.",
        variant: "destructive",
      });
    }
  };

  const handleRemoveStudent = (enrollmentId: string, studentName: string) => {
    setStudentToRemove({ enrollmentId, name: studentName });
    setRemoveStudentDialogOpen(true);
  };

  const inviteLink =
    typeof window !== "undefined" && classroom?.join_code
      ? `${window.location.origin}/join/classroom/${classroom.join_code}`
      : "";

  const copyInviteLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopiedInvite(true);
      toast({
        title: "Invite link copied!",
        description: "Share this link to let students join your class.",
      });
      setTimeout(() => setCopiedInvite(false), 2000);
    } catch (error) {
      console.error("Failed to copy invite link:", error);
      toast({
        title: "Copy failed",
        description: "Unable to copy the invite link. Please copy it manually.",
        variant: "destructive",
      });
    }
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
          <Button
            onClick={() => router.push(`/dashboard/teacher/student-records?classroomId=${classroomId}`)}
            className="gap-2 shrink-0"
          >
            <FileText className="w-4 h-4" />
            View classroom reports
          </Button>
        </div>

        {/* Classroom Info Cards */}
        <div className="grid md:grid-cols-3 gap-4">
          {/* Join Code Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Join Code
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className="font-mono text-lg tracking-widest flex-1 justify-center py-2"
                >
                  {classroom?.join_code}
                </Badge>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => classroom && copyJoinCode(classroom.join_code)}
                >
                  {copiedCode ? (
                    <Check className="w-4 h-4 text-accent" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Invite link</Label>
                <div className="flex items-center gap-2">
                  <Input value={inviteLink} readOnly />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyInviteLink}
                    disabled={!inviteLink}
                  >
                    {copiedInvite ? (
                      <Check className="w-4 h-4 text-accent" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

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

        {/* Description */}
        {classroom?.description && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">About This Classroom</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{classroom.description}</p>
            </CardContent>
          </Card>
        )}

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
          <CardContent>
            {rosterLoading && (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-4 rounded-lg border animate-pulse">
                    <div className="w-12 h-12 bg-secondary rounded-full" />
                    <div className="flex-1">
                      <div className="h-4 bg-secondary rounded w-32 mb-2" />
                      <div className="h-3 bg-secondary rounded w-24" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!rosterLoading && (!filteredRoster || filteredRoster.length === 0) && !searchQuery && (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No students enrolled yet</h3>
                <p className="text-muted-foreground mb-4">
                  Share the join code with your students to get started
                </p>
                <Button
                  variant="outline"
                  onClick={() => classroom && copyJoinCode(classroom.join_code)}
                  className="gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copy Join Code
                </Button>
              </div>
            )}

            {!rosterLoading && (!filteredRoster || filteredRoster.length === 0) && searchQuery && (
              <div className="text-center py-12">
                <Search className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No students found</h3>
                <p className="text-muted-foreground">
                  No students match your search query &quot;{searchQuery}&quot;
                </p>
              </div>
            )}

            {!rosterLoading && filteredRoster && filteredRoster.length > 0 && (
              <div className="space-y-2">
                {filteredRoster.map((enrollment) => {
                  const studentName = (enrollment.profiles as ProfileLike | null)?.display_name || "Student";
                  const studentEmail = (enrollment.profiles as ProfileLike | null)?.email || "Email unavailable";
                  const avatarUrl = (enrollment.profiles as ProfileLike | null)?.avatar_url;
                  
                  return (
                    <div
                      key={enrollment.id}
                      className="flex items-center gap-4 p-4 rounded-lg border hover:bg-secondary/30 transition-colors group"
                    >
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={avatarUrl} />
                        <AvatarFallback className="text-lg">
                          {(studentName[0] || "S").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{studentName}</p>
                        <p className="text-sm text-muted-foreground truncate">{studentEmail}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Joined {new Date(enrollment.joined_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
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
                          className="opacity-60 group-hover:opacity-100 focus:opacity-100 focus-visible:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleRemoveStudent(enrollment.id, studentName)}
                        >
                          <UserMinus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
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
                They can rejoin using the classroom code.
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
