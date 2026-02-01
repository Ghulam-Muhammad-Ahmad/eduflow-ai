import { withAuth } from "@/lib/withAuth";
import TeacherAssignments from "@/pages/dashboard/TeacherAssignments";

export default withAuth(TeacherAssignments, { allowedRoles: ["teacher"] });
