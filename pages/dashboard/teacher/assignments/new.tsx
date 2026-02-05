import { withAuth } from "@/lib/withAuth";
import TeacherCreateAssignment from "@/pages/dashboard/TeacherCreateAssignment";

export default withAuth(TeacherCreateAssignment, { allowedRoles: ["teacher"] });
