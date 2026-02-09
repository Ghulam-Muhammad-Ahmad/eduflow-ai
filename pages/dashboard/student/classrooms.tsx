import { withAuth } from "@/lib/withAuth";
import StudentClassrooms from "@/features/dashboard/student/StudentClassrooms";

export default withAuth(StudentClassrooms, { allowedRoles: ["student"] });
