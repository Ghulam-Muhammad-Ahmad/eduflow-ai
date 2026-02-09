import { withAuth } from "@/lib/withAuth";
import TeacherDashboard from "@/features/dashboard/teacher/TeacherDashboard";

export default withAuth(TeacherDashboard, { allowedRoles: ["teacher"] });
