import { withAuth } from "@/lib/withAuth";
import TeacherAssignments from "@/features/dashboard/teacher/TeacherAssignments";

export default withAuth(TeacherAssignments, { allowedRoles: ["teacher"] });
