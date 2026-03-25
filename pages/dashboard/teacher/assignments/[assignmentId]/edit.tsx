import { withAuth } from "@/lib/withAuth";
import TeacherEditAssignment from "@/features/dashboard/teacher/TeacherEditAssignment";

function TeacherEditAssignmentPage() {
  return <TeacherEditAssignment />;
}

export default withAuth(TeacherEditAssignmentPage, { allowedRoles: ["teacher"] });
