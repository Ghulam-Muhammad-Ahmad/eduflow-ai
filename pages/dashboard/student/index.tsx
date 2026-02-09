import { withAuth } from "@/lib/withAuth";
import StudentDashboard from "@/features/dashboard/student/StudentDashboard";

export default withAuth(StudentDashboard, { allowedRoles: ["student"] });
