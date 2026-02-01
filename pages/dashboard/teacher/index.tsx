import { withAuth } from "@/lib/withAuth";
import TeacherDashboard from "@/pages/dashboard/TeacherDashboard";

export default withAuth(TeacherDashboard, { allowedRoles: ["teacher"] });
