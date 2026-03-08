import { useMemo, useState } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useTutorStudents } from "@/hooks/useTutorWorkspace";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, School, Mail } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ClassroomLectureSection } from "@/components/lectures/ClassroomLectureSection";
import { useGoogleCalendarConnection } from "@/hooks/useLectureSessions";
import { GoogleCalendarConnectionCard } from "@/components/lectures/GoogleCalendarConnectionCard";

const TeacherStudentsList = () => {
  const router = useRouter();
  const { students, isLoading } = useTutorStudents();
  const { user } = useAuth();
  const { data: googleCalendarConnection } = useGoogleCalendarConnection();
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const selectedStudent = useMemo(
    () => students?.find((student) => student.id === selectedStudentId) ?? null,
    [selectedStudentId, students]
  );

  const disableSchedulingReason = !googleCalendarConnection?.configured
    ? "Google Meet scheduling is unavailable until Google OAuth is configured on the server."
    : !googleCalendarConnection.connected
      ? "Connect Google Calendar before creating or rescheduling one-to-one lecture sessions."
      : null;

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">My Students</h1>
          <p className="text-muted-foreground mt-1">
            Students are added to your classes by your workspace owner.
          </p>
        </div>

        <GoogleCalendarConnectionCard redirectTo="/dashboard/teacher/students" />

        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-secondary rounded w-3/4" />
                  <div className="h-4 bg-secondary rounded w-1/2 mt-2" />
                </CardHeader>
              </Card>
            ))}
          </div>
        )}

        {!isLoading && (!students || students.length === 0) && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="rounded-full bg-primary/10 p-4 mb-4">
                <Users className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No students yet</h3>
              <p className="text-muted-foreground text-center mb-6 max-w-sm">
                Students are added to your classes by your workspace owner. When they add students to a class you teach, they&apos;ll appear here.
              </p>
              <Button variant="outline" onClick={() => router.push("/dashboard/teacher/classrooms")} className="gap-2">
                <School className="w-4 h-4" />
                Go to My Classes
              </Button>
            </CardContent>
          </Card>
        )}

        {!isLoading && students && students.length > 0 && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {students.map((student) => (
                <Card
                  key={student.id}
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => router.push(`/dashboard/teacher/student-records/${student.id}`)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {(student.display_name || student.email || "?")[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base truncate">
                          {student.display_name || "No name"}
                        </CardTitle>
                        {student.email && (
                          <CardDescription className="flex items-center gap-1 truncate">
                            <Mail className="w-3 h-3 shrink-0" />
                            {student.email}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/dashboard/teacher/student-records/${student.id}`);
                      }}
                    >
                      View records
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedStudentId(student.id);
                      }}
                    >
                      Manage 1:1 sessions
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {selectedStudent && user && (
              <ClassroomLectureSection
                scopeType="one_to_one"
                studentId={selectedStudent.id}
                targetName={selectedStudent.display_name || selectedStudent.email || "this student"}
                canManage
                canCompleteOutcomes
                canEditPrivateNotes
                canEditMockFinancials
                showPrivateNotes
                disableSchedulingReason={disableSchedulingReason}
                tutorOptions={[
                  {
                    id: user.id,
                    name: "You",
                  },
                ]}
                defaultTutorId={user.id}
                description="Schedule direct Google Meet sessions for this student using your connected calendar."
                emptyMessage="No one-to-one sessions scheduled yet for this student."
              />
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default TeacherStudentsList;
