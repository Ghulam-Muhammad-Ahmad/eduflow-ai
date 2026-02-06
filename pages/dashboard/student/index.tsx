import { withAuth } from "@/lib/withAuth";
import StudentDashboard from "@/pages/dashboard/student/StudentDashboard";

export default withAuth(StudentDashboard, { allowedRoles: ["student"] });
