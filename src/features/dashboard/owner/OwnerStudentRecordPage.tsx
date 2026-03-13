import { useRouter } from "next/router";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useOwnerStudentRecords } from "@/hooks/useOwnerStudentRecords";
import type { StudentRecord } from "@/hooks/useTeacherStudentRecords";
import { StudentRecordView } from "@/features/dashboard/teacher/StudentRecordView";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Users, ArrowLeft } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { generateStudentPDF } from "@/lib/pdfReports";

const OwnerStudentRecordPage = () => {
  const router = useRouter();
  const { studentId, classroomId, roomId } = router.query;
  const { toast } = useToast();
  const studentIdStr = Array.isArray(studentId) ? studentId[0] : studentId;
  const classroomIdStr = Array.isArray(classroomId) ? classroomId[0] : classroomId;
  const roomIdStr = Array.isArray(roomId) ? roomId[0] : roomId;

  const { data, isLoading, error } = useOwnerStudentRecords(
    classroomIdStr ?? null,
    roomIdStr ?? null
  );
  const students = data?.students ?? [];
  const student = studentIdStr
    ? students.find(
        (s) =>
          s.student_id === studentIdStr &&
          (classroomIdStr ? s.classroom_id === classroomIdStr : roomIdStr ? s.classroom_id === roomIdStr : true)
      )
    : null;

  const handleExportPDF = (s: StudentRecord) => {
    try {
      const doc = generateStudentPDF(s, format(new Date(), "PPpp"));
      const name = (s.display_name || "Student").replace(/\s+/g, "-");
      doc.save(`student-report-${name}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast({
        title: "PDF exported",
        description: `Report for ${s.display_name || "Student"} has been downloaded.`,
      });
    } catch (e) {
      toast({
        title: "Export failed",
        description: e instanceof Error ? e.message : "Could not generate PDF",
        variant: "destructive",
      });
    }
  };

  const handleBack = () => {
    router.push("/dashboard/owner/student-records");
  };

  if (error) {
    return (
      <DashboardLayout>
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load records: {error.message}</p>
            <Button variant="outline" className="mt-4" onClick={handleBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Student Records
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  if (isLoading || !studentIdStr || (!classroomIdStr && !roomIdStr)) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  if (!student) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Student record not found. They may not be in this classroom or 1v1 room.</p>
            <Button variant="outline" className="mt-4" onClick={handleBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Student Records
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={handleBack} aria-label="Back to student records">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-2">
                <Users className="w-8 h-8 text-medium-slate-blue" />
                {student.display_name || "Student"} — Report
              </h1>
              <p className="text-muted-foreground mt-1">
                {student.classroom_name}
                {student.email ? ` • ${student.email}` : ""} • Joined{" "}
                {student.joined_at ? format(new Date(student.joined_at), "MMMM d, yyyy") : "—"}
              </p>
            </div>
          </div>
        </div>

        <StudentRecordView student={student} onExportPDF={handleExportPDF} />
      </div>
    </DashboardLayout>
  );
};

export default OwnerStudentRecordPage;
