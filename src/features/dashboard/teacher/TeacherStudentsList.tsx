import { useState, useMemo } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useTutorStudents, useTutorStudentClassrooms } from "@/hooks/useTutorWorkspace";
import { useClassrooms } from "@/hooks/useClassrooms";
import { useOneToOneRooms } from "@/hooks/useOneToOneRooms";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, School, Mail, Video, ScrollText, Search, UserCircle } from "lucide-react";

const TeacherStudentsList = () => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const { students, isLoading } = useTutorStudents();
  const { classrooms = [] } = useClassrooms();
  const { oneToOneRooms = [] } = useOneToOneRooms();
  const studentClassrooms = useTutorStudentClassrooms(
    students?.map((s) => s.id) ?? [],
    classrooms
  );

  const studentToRooms = useMemo(() => {
    const map: Record<string, typeof oneToOneRooms> = {};
    for (const room of oneToOneRooms) {
      if (!map[room.student_id]) map[room.student_id] = [];
      map[room.student_id].push(room);
    }
    return map;
  }, [oneToOneRooms]);

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
      <div className="space-y-6 min-w-0 w-full max-w-[1600px]">
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

        {!isLoading && students && students.length > 0 && (
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden />
                <Input
                  type="search"
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  aria-label="Search students"
                />
              </div>
            </div>
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
                    <th className="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Classrooms
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground hidden md:table-cell">
                      1v1 Rooms
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-sm text-muted-foreground">
                        No students match &quot;{searchQuery}&quot;. Try a different search.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((student) => {
                      const names = studentClassrooms[student.id] ?? [];
                      const rooms = studentToRooms[student.id] ?? [];
                      return (
                        <tr key={student.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-6 py-3.5">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9 shrink-0">
                                <AvatarImage src={student.avatar_url ?? undefined} alt="" />
                                <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                                  {(student.display_name || student.email || "?")[0].toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <span className="font-medium text-foreground">
                                  {student.display_name || "No name"}
                                </span>
                                {student.email && (
                                  <p className="text-muted-foreground text-xs sm:hidden mt-0.5 truncate max-w-[180px]">
                                    {student.email}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-3.5 text-muted-foreground hidden sm:table-cell">
                            <a
                              href={`mailto:${student.email}`}
                              onClick={(e) => e.stopPropagation()}
                              className="hover:text-foreground truncate max-w-[200px] block"
                            >
                              {student.email ?? "—"}
                            </a>
                          </td>
                          <td className="px-6 py-3.5">
                            {names.length === 0 ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <span className="flex flex-wrap gap-1">
                                {names.slice(0, 2).map((name) => (
                                  <span
                                    key={name}
                                    className="inline-flex items-center rounded-md bg-muted/80 px-2 py-0.5 text-xs text-muted-foreground"
                                  >
                                    {name}
                                  </span>
                                ))}
                                {names.length > 2 && (
                                  <span className="text-xs text-muted-foreground">+{names.length - 2}</span>
                                )}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-3.5 hidden md:table-cell">
                            {rooms.length === 0 ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <span className="flex flex-wrap gap-1">
                                {rooms.map((room) => (
                                  <Link
                                    key={room.id}
                                    href={`/dashboard/teacher/rooms/${room.id}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary hover:bg-primary/20 border border-primary/20"
                                  >
                                    <UserCircle className="h-3 w-3 shrink-0" />
                                    {room.name || "1v1"}
                                  </Link>
                                ))}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border">
              <div className="h-10 bg-muted/50 rounded-md max-w-sm animate-pulse" />
            </div>
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                  <div className="h-9 w-9 rounded-full bg-muted" />
                  <div className="h-4 bg-muted rounded flex-1 max-w-[200px]" />
                  <div className="h-4 bg-muted rounded w-24" />
                  <div className="h-9 bg-muted rounded w-20" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default TeacherStudentsList;
