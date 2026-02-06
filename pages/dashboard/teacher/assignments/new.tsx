import { withAuth } from "@/lib/withAuth";
import TeacherCreateAssignment from "@/pages/dashboard/teacher/TeacherCreateAssignment";

export default withAuth(TeacherCreateAssignment, { allowedRoles: ["teacher"] });
