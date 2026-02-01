import { withAuth } from "@/lib/withAuth";
import StudentClassrooms from "@/pages/dashboard/StudentClassrooms";

export default withAuth(StudentClassrooms, { allowedRoles: ["student"] });
