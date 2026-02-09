import { withAuth } from "@/lib/withAuth";
import StudentAssignments from "@/features/dashboard/student/StudentAssignments";

export default withAuth(StudentAssignments, { allowedRoles: ["student"] });
