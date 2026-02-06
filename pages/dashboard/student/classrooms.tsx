import { withAuth } from "@/lib/withAuth";
import StudentClassrooms from "@/pages/dashboard/student/StudentClassrooms";

export default withAuth(StudentClassrooms, { allowedRoles: ["student"] });
