import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useOwnerStudentRecords } from "@/hooks/useOwnerStudentRecords";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import type { StudentRecord } from "@/hooks/useTeacherStudentRecords";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import {
  FileText,
  Users,
  ClipboardList,
  ListChecks,
  Search,
  BookOpen,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const OwnerStudentRecords = () => {
  const router = useRouter();
  const queryClassroomId = router.query.classroomId as string | undefined;
  const queryRoomId = router.query.roomId as string | undefined;
  const [contextFilter, setContextFilter] = useState<string>("all"); // "all" | "classroom:id" | "room:id"
  const [searchQuery, setSearchQuery] = useState("");
  const { oneToOneRooms = [] } = useOwnerWorkspace();
  const classroomId = contextFilter.startsWith("classroom:") ? contextFilter.replace("classroom:", "") : null;
  const oneToOneRoomId = contextFilter.startsWith("room:") ? contextFilter.replace("room:", "") : null;
  const effectiveClassroomId = contextFilter === "all" ? null : classroomId;
  const { data, isLoading, error } = useOwnerStudentRecords(effectiveClassroomId, oneToOneRoomId);
  const { toast } = useToast();

  useEffect(() => {
    if (queryRoomId) setContextFilter(`room:${queryRoomId}`);
    else if (queryClassroomId) setContextFilter(`classroom:${queryClassroomId}`);
  }, [queryClassroomId, queryRoomId]);

  const goToStudentRecord = (student: StudentRecord) => {
    const is1v1 = student.classroom_name.startsWith("1v1:");
    if (is1v1)
      router.push(`/dashboard/owner/student-records/${student.student_id}?roomId=${student.classroom_id}`);
    else
      router.push(`/dashboard/owner/student-records/${student.student_id}?classroomId=${student.classroom_id}`);
  };

  const classrooms = data?.classrooms ?? [];
  const classroomName = oneToOneRoomId
    ? (oneToOneRooms.find((r) => r.id === oneToOneRoomId)?.name || "1v1 Room")
    : classroomId
      ? classrooms.find((c) => c.id === classroomId)?.name ?? "Classroom"
      : "All Classrooms";

  const filteredStudents = useMemo(() => {
    const students = data?.students ?? [];
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase();
    return students.filter(
      (s) =>
        (s.display_name ?? "").toLowerCase().includes(q) ||
        (s.email ?? "").toLowerCase().includes(q)
    );
  }, [data?.students, searchQuery]);

  const formatPct = (v: number | null) =>
    v != null ? `${Math.round(v)}%` : "—";

  if (error) {
    return (
      <DashboardLayout>
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <p className="text-destructive">
              Failed to load records: {error.message}
            </p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-2">
              <Users className="w-8 h-8 text-medium-slate-blue" />
              Student Records & Grades
            </h1>
            <p className="text-muted-foreground mt-1">
              View all enrolled students and their grades across assignments and quizzes.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Classrooms
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{classrooms.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="w-4 h-4" />
                Students
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredStudents.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ClipboardList className="w-4 h-4" />
                Assignments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data?.assignments?.length ?? 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ListChecks className="w-4 h-4" />
                Quizzes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data?.quizzes?.length ?? 0}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Centralized grades</CardTitle>
            <CardDescription>
              Select a classroom / 1v1 room or view all. Use the row expand to see assignment and quiz details.
            </CardDescription>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Select value={contextFilter} onValueChange={setContextFilter}>
                <SelectTrigger className="w-full sm:w-[280px]">
                  <SelectValue placeholder="Select classroom / 1v1 room" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All (classrooms & 1v1 rooms)</SelectItem>
                  {classrooms.map((c) => (
                    <SelectItem key={c.id} value={`classroom:${c.id}`}>
                      {c.name} ({c.studentCount})
                    </SelectItem>
                  ))}
                  {oneToOneRooms.map((r) => (
                    <SelectItem key={r.id} value={`room:${r.id}`}>
                      1v1: {r.name || `${r.studentProfile?.display_name ?? "Student"}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No students in this selection.</p>
                <p className="text-sm mt-1">Change classroom or search criteria.</p>
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Student</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead className="text-right">Overall</TableHead>
                      <TableHead className="text-right">Graded</TableHead>
                      <TableHead className="w-[140px] text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((student) => {
                      return (
                        <TableRow
                          key={`${student.student_id}-${student.classroom_id}`}
                          className="align-middle cursor-pointer"
                          onClick={() => goToStudentRecord(student)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              goToStudentRecord(student);
                            }
                          }}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3 min-w-[260px]">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={student.avatar_url ?? undefined} />
                                <AvatarFallback className="bg-medium-slate-blue/10 text-medium-slate-blue">
                                  {(student.display_name || "?")[0].toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="font-medium truncate">{student.display_name || "Unknown"}</p>
                                {student.email && (
                                  <p className="text-xs text-muted-foreground truncate">{student.email}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{student.classroom_name}</TableCell>
                          <TableCell className="text-right font-mono font-medium whitespace-nowrap">
                            {formatPct(student.overallAvg)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground text-sm whitespace-nowrap">
                            A {student.gradedAssignments}/{student.totalAssignments} · Q {student.gradedQuizzes}/{student.totalQuizzes}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  goToStudentRecord(student);
                                }}
                              >
                                <FileText className="w-4 h-4 mr-2" />
                                Report
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default OwnerStudentRecords;
