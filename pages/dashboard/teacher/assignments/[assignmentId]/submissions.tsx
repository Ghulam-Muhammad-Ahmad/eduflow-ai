import { withAuth } from "@/lib/withAuth";
import TeacherAssignmentSubmissions from "@/pages/dashboard/TeacherAssignmentSubmissions";

export default withAuth(TeacherAssignmentSubmissions, { allowedRoles: ["teacher"] });
