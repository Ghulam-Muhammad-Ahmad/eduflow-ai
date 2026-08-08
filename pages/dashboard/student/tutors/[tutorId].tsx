import { withAuth } from "@/lib/withAuth";
import StudentTutorProfile from "@/features/dashboard/student/StudentTutorProfile";

export default withAuth(StudentTutorProfile, { allowedRoles: ["student"] });
