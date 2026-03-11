import { useState, useMemo } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useTutorStudents, useTutorStudentClassrooms } from "@/hooks/useTutorWorkspace";
import { useClassrooms } from "@/hooks/useClassrooms";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users, School, Mail, Video, ScrollText, Search } from "lucide-react";

const TeacherStudentsList = () => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const { students, isLoading } = useTutorStudents();
  const { classrooms = [] } = useClassrooms();
  const studentClassrooms = useTutorStudentClassrooms(
    students?.map((s) => s.id) ?? [],
    classrooms
  );

  const filteredStudents = useMemo(() => {
    if (!students) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        (s.display_name?.toLowerCase().includes(q)) ||
        (s.email?.toLowerCase().includes(q))
    );
  }, [students, searchQuery]);

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-8 min-w-0 mx-auto">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="text-center sm:text-left">
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
              My Students
            </h1>
            <p className="text-muted-foreground mt-1.5 max-w-xl sm:max-w-none">
              Students are added to your classes by your workspace owner. Schedule 1:1 sessions from the Sessions page.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="gap-2 shrink-0 border-border/80 w-full sm:w-auto">
            <Link href="/dashboard/teacher/sessions">
              <Video className="h-4 w-4" />
              Sessions
            </Link>
          </Button>
        </div>

        {!isLoading && students && students.length > 0 && (
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 rounded-lg border-border/80 bg-background"
              aria-label="Search students"
            />
          </div>
        )}

        {isLoading && (
          <div className="flex flex-wrap justify-start gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="w-full sm:w-[280px] lg:w-[300px] overflow-hidden border-border/60 bg-card rounded-xl">
                <CardContent className="p-0">
                  <div className="p-6 space-y-4 animate-pulse text-center">
                    <div className="flex justify-center">
                      <div className="h-16 w-16 rounded-full bg-muted" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-5 bg-muted rounded w-3/4 mx-auto" />
                      <div className="h-4 bg-muted rounded w-full" />
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                      <div className="h-6 bg-muted rounded-full w-20" />
                      <div className="h-6 bg-muted rounded-full w-24" />
                    </div>
                    <div className="h-10 bg-muted rounded-lg w-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!isLoading && (!students || students.length === 0) && (
          <Card className="border-dashed border-2 border-muted-foreground/20 bg-muted/20 max-w-md mx-auto rounded-xl">
            <CardContent className="flex flex-col items-center justify-center py-20 px-8">
              <div className="rounded-full bg-primary/10 p-5 mb-5">
                <Users className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No students yet</h3>
              <p className="text-muted-foreground text-center mb-8 max-w-sm">
                Students are added to your classes by your workspace owner. When they add students to a class you teach, they&apos;ll appear here.
              </p>
              <Button variant="outline" onClick={() => router.push("/dashboard/teacher/classrooms")} className="gap-2">
                <School className="w-4 h-4" />
                Go to My Classes
              </Button>
            </CardContent>
          </Card>
        )}

        {!isLoading && students && students.length > 0 && filteredStudents.length === 0 && (
          <Card className="border-dashed border-2 border-muted-foreground/20 bg-muted/10 max-w-md mx-auto rounded-xl">
            <CardContent className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <Search className="w-10 h-10 text-muted-foreground mb-3" />
              <h3 className="font-semibold text-foreground mb-1">No matches</h3>
              <p className="text-sm text-muted-foreground mb-4">
                No students match &quot;{searchQuery.trim()}&quot;. Try a different name or email.
              </p>
              <Button variant="outline" size="sm" onClick={() => setSearchQuery("")}>
                Clear search
              </Button>
            </CardContent>
          </Card>
        )}

        {!isLoading && students && students.length > 0 && filteredStudents.length > 0 && (
          <div className="flex flex-wrap justify-start gap-5">
            {filteredStudents.map((student) => {
              const names = studentClassrooms[student.id] ?? [];
              return (
                <Card
                  key={student.id}
                  className="group w-full sm:w-[280px] lg:w-[300px] overflow-hidden border-border/60 bg-card rounded-xl transition-all duration-200 hover:border-primary/25 hover:shadow-xl hover:shadow-primary/5"
                >
                  <CardContent className="p-0">
                    <div className="p-6 flex flex-col items-center text-center">
                      <Avatar className="h-16 w-16 shrink-0 ring-2 ring-border/80 group-hover:ring-primary/30 transition-colors mb-4">
                        <AvatarImage src={student.avatar_url ?? undefined} alt="" />
                        <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
                          {(student.display_name || student.email || "?")[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <h3 className="font-semibold text-foreground text-base leading-tight mb-1">
                        {student.display_name || "No name"}
                      </h3>
                      {student.email && (
                        <a
                          href={`mailto:${student.email}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 break-all"
                        >
                          <Mail className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate max-w-[220px]">{student.email}</span>
                        </a>
                      )}

                      {names.length > 0 && (
                        <div className="w-full mb-4">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                            Classrooms
                          </p>
                          <div className="flex flex-wrap justify-center gap-1.5">
                            {names.map((name) => (
                              <Badge
                                key={name}
                                variant="secondary"
                                className="font-normal text-xs py-0.5 px-2 bg-muted/80 text-muted-foreground border-0"
                              >
                                {name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <Button
                        className="w-full gap-2 font-medium rounded-lg mt-auto"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/dashboard/teacher/student-records/${student.id}`);
                        }}
                      >
                        <ScrollText className="h-4 w-4" />
                        View records
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default TeacherStudentsList;
