import { withAuth } from "@/lib/withAuth";
import TeacherAssignments from "@/pages/dashboard/teacher/TeacherAssignments";

export default withAuth(TeacherAssignments, { allowedRoles: ["teacher"] });
