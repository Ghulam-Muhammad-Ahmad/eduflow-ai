import { withAuth } from "@/lib/withAuth";
import TeacherAssignmentSubmissions from "@/features/dashboard/teacher/TeacherAssignmentSubmissions";

export default withAuth(TeacherAssignmentSubmissions, { allowedRoles: ["teacher"] });
