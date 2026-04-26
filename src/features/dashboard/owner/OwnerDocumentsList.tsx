import { useMemo } from "react";
import TeacherDocuments from "@/features/dashboard/teacher/TeacherDocuments";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";

export default function OwnerDocumentsList() {
  const { tutors, assignedStudents } = useOwnerWorkspace();

  const workspaceUsers = useMemo(() => {
    const tutorUsers = tutors.map((t) => ({
      id: t.user_id,
      name: t.profile?.display_name || t.profile?.email || "Tutor",
      role: "tutor" as const,
    }));
    const studentUsers = assignedStudents.map((s) => ({
      id: s.student_id,
      name: s.student?.display_name || s.student?.email || "Student",
      role: "student" as const,
    }));
    return [...tutorUsers, ...studentUsers];
  }, [tutors, assignedStudents]);

  return (
    <TeacherDocuments
      dashboardHref="/dashboard/owner"
      documentsHref="/dashboard/owner/documents"
      shareMode="users"
      workspaceUsers={workspaceUsers}
    />
  );
}
