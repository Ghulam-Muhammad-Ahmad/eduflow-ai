import { withAuth } from "@/lib/withAuth";
import StudentAssignments from "@/pages/dashboard/StudentAssignments";

export default withAuth(StudentAssignments, { allowedRoles: ["student"] });
