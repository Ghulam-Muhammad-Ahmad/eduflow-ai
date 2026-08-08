import { withAuth } from "@/lib/withAuth";
import StudentAssignmentDetail from "@/features/dashboard/student/StudentAssignmentDetail";

export default withAuth(StudentAssignmentDetail, { allowedRoles: ["student"] });
