import { withAuth } from "@/lib/withAuth";
import TeacherDashboard from "@/pages/dashboard/teacher/TeacherDashboard";

export default withAuth(TeacherDashboard, { allowedRoles: ["teacher"] });
