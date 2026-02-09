import { withAuth } from "@/lib/withAuth";
import TeacherCreateAssignment from "@/features/dashboard/teacher/TeacherCreateAssignment";

export default withAuth(TeacherCreateAssignment, { allowedRoles: ["teacher"] });
