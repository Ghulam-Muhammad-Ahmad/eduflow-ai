import { withAuth } from "@/lib/withAuth";
import StudentAssignments from "@/pages/dashboard/student/StudentAssignments";

export default withAuth(StudentAssignments, { allowedRoles: ["student"] });
