import { useState, useMemo } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useTeacherStudentRecords, type StudentRecord } from "@/hooks/useTeacherStudentRecords";
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
import { generateClassroomPDF } from "@/lib/pdfReports";
import {
  FileDown,
  FileText,
  Users,
  ClipboardList,
  ListChecks,
  Search,
  BookOpen,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const TeacherStudentRecords = () => {
  const router = useRouter();
  const [classroomId, setClassroomId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { data, isLoading, error } = useTeacherStudentRecords(classroomId);
  const { toast } = useToast();

  const goToStudentRecord = (student: StudentRecord) => {
    router.push(`/dashboard/teacher/student-records/${student.student_id}?classroomId=${student.classroom_id}`);
  };

  const classrooms = data?.classrooms ?? [];
  const students = data?.students ?? [];
  const classroomName = classroomId
    ? classrooms.find((c) => c.id === classroomId)?.name ?? "Classroom"
    : "All Classrooms";

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase();
    return students.filter(
      (s) =>
        (s.display_name ?? "").toLowerCase().includes(q) ||
        (s.email ?? "").toLowerCase().includes(q)
    );
  }, [students, searchQuery]);

  const handleExportClassroomPDF = () => {
    if (filteredStudents.length === 0) {
      toast({
        title: "No students",
        description: "There are no students to export for this selection.",
        variant: "destructive",
      });
      return;
    }
    try {
      const doc = generateClassroomPDF(
        classroomName,
        filteredStudents,
        format(new Date(), "PPpp")
      );
      doc.save(`grade-report-${classroomName.replace(/\s+/g, "-")}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast({
        title: "PDF exported",
        description: `Grade report for ${classroomName} has been downloaded.`,
      });
    } catch (e) {
      toast({
        title: "Export failed",
        description: e instanceof Error ? e.message : "Could not generate PDF",
        variant: "destructive",
      });
    }
  };

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
              View all enrolled students and their grades across assignments and quizzes. Export full class or per-student PDF reports.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleExportClassroomPDF}
              disabled={isLoading || filteredStudents.length === 0}
              className="bg-medium-slate-blue hover:bg-medium-slate-blue/90"
            >
              <FileDown className="w-4 h-4 mr-2" />
              Export class PDF
            </Button>
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
                Students (this view)
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
              Select a classroom or view all. Use the row expand to see assignment and quiz details. Export a PDF for the whole class or for an individual student.
            </CardDescription>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Select
                value={classroomId ?? "all"}
                onValueChange={(v) => setClassroomId(v === "all" ? null : v)}
              >
                <SelectTrigger className="w-full sm:w-[240px]">
                  <SelectValue placeholder="Select classroom" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All classrooms</SelectItem>
                  {classrooms.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.studentCount})
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
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-medium-slate-blue" />
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

export default TeacherStudentRecords;
