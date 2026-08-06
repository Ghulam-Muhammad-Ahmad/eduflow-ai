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
  ArrowLeft,
  Users,
  Search,
  BookOpen,
  ClipboardList,
  FileText,
  ScrollText,
  Video,
} from "lucide-react";
import { ClassroomSettingsSection, type ClassroomSettingsForm } from "@/features/dashboard/shared/ClassroomSettingsSection";

const TeacherClassroomDetail = () => {
  const router = useRouter();
  const { classroomId } = router.query as { classroomId: string };
  const {
    classrooms,
    isLoading: classroomsLoading,
    updateClassroomSettings,
  } = useClassrooms();
  const { data: roster, isLoading: rosterLoading } = useClassroomRoster(classroomId || null);
  const { assignments } = useAssignments(classroomId);

  const [searchQuery, setSearchQuery] = useState("");

  const classroom = classrooms?.find((c) => c.id === classroomId);
  const classAssignments = assignments ?? [];

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

  // Student contact details are deliberately not available to teachers.
  type ProfileLike = { display_name?: string; avatar_url?: string };
  // Filter students based on search query
  const filteredRoster = roster?.filter((enrollment) => {
    const studentName = (enrollment.profiles as ProfileLike | null)?.display_name || "Student";
    return studentName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        {/* Header — same layout as owner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/dashboard/teacher/classrooms">
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold truncate">{classroom?.name}</h1>
              {classroom?.subject && (
                <p className="text-muted-foreground">{classroom.subject}</p>
              )}
            </div>
          </div>
          {classroomId && (
            <Button asChild variant="outline" className="gap-2 shrink-0" size="sm">
              <Link href={`/dashboard/teacher/sessions?classroomId=${classroomId}`}>
                <Video className="w-4 h-4" />
                View sessions
              </Link>
            </Button>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{roster?.length ?? 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Assignments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{classAssignments.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Classroom Settings — same component as owner, inline on page */}
        {classroom && (
          <ClassroomSettingsSection
            classroomName={classroom.name}
            settings={classroom.settings as ClassroomSettingsForm | null | undefined}
            onSave={async (settings) => {
              await updateClassroomSettings.mutateAsync({ id: classroom.id, settings });
            }}
            isSaving={updateClassroomSettings.isPending}
          />
        )}

        {/* Roster — same table style as owner */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle>Roster</CardTitle>
                <CardDescription>
                  {filteredRoster?.length ?? 0} student{(filteredRoster?.length ?? 0) !== 1 ? "s" : ""} enrolled
                </CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
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
                      <th className="px-6 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground w-24">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredRoster.map((enrollment) => {
                      const studentName = (enrollment.profiles as ProfileLike | null)?.display_name || "Student";
                      const avatarUrl = (enrollment.profiles as ProfileLike | null)?.avatar_url;
                      return (
                        <tr key={enrollment.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-6 py-3.5">
                            <Link
                              href={`/dashboard/teacher/student-records/${enrollment.student_id}?classroomId=${classroomId}`}
                              className="flex items-center gap-3 font-medium text-foreground hover:text-primary transition-colors"
                            >
                              <Avatar className="h-9 w-9 shrink-0">
                                <AvatarImage src={avatarUrl} />
                                <AvatarFallback className="text-sm">{(studentName[0] || "S").toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <span className="truncate">{studentName}</span>
                            </Link>
                          </td>
                          <td className="px-6 py-3.5 text-right">
                            <Button asChild variant="outline" size="sm" className="gap-1.5">
                              <Link href={`/dashboard/teacher/student-records/${enrollment.student_id}?classroomId=${classroomId}`}>
                                <ScrollText className="w-4 h-4" />
                                View record
                              </Link>
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

        {/* Class overview — same as owner */}
        <section className="space-y-6" aria-labelledby="class-overview-heading">
          <h2 id="class-overview-heading" className="text-lg font-semibold tracking-tight text-foreground border-b border-border/60 pb-2">
            Class overview
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xl font-semibold">Class report</CardTitle>
                <CardDescription>
                  Student records, grades, and progress for this class
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={classroomId ? `/dashboard/teacher/student-records?classroomId=${classroomId}` : "#"}>
                  <Button variant="default" className="w-fit">
                    View full student records
                  </Button>
                </Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xl font-semibold">Assignments</CardTitle>
                <CardDescription>
                  {classAssignments.length} assignment{classAssignments.length !== 1 ? "s" : ""} in this class
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {classAssignments.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No assignments yet. Create one from Assignments.</p>
                ) : (
                  <ul className="space-y-2 max-h-40 overflow-y-auto">
                    {classAssignments.slice(0, 5).map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-2 text-sm py-1.5 border-b border-border/40 last:border-0">
                        <span className="font-medium truncate">{a.title ?? "Assignment"}</span>
                        <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {a.status ?? "draft"}
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
        </section>

      </div>
    </DashboardLayout>
  );
};

export default TeacherClassroomDetail;
