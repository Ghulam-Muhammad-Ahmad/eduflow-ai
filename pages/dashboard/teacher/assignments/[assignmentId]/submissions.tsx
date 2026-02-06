import { withAuth } from "@/lib/withAuth";
import TeacherAssignmentSubmissions from "@/pages/dashboard/teacher/TeacherAssignmentSubmissions";

export default withAuth(TeacherAssignmentSubmissions, { allowedRoles: ["teacher"] });
