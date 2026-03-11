import { withAuth } from "@/lib/withAuth";
import StudentSessions from "@/features/dashboard/student/StudentSessions";

export default withAuth(StudentSessions, { allowedRoles: ["student"] });
