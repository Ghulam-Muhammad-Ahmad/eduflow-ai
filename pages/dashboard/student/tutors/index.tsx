import { withAuth } from "@/lib/withAuth";
import StudentTutors from "@/features/dashboard/student/StudentTutors";

export default withAuth(StudentTutors, { allowedRoles: ["student"] });
