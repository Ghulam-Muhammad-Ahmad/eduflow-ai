import { withAuth } from "@/lib/withAuth";
import StudentProgress from "@/features/dashboard/student/StudentProgress";

export default withAuth(StudentProgress, { allowedRoles: ["student"] });
