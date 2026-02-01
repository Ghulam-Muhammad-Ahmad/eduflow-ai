import { withAuth } from "@/lib/withAuth";
import StudentDashboard from "@/pages/dashboard/StudentDashboard";

export default withAuth(StudentDashboard, { allowedRoles: ["student"] });
