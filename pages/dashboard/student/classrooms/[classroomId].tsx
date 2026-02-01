import { withAuth } from "@/lib/withAuth";
import StudentClassroomDetail from "@/pages/dashboard/StudentClassroomDetail";

export default withAuth(StudentClassroomDetail, { allowedRoles: ["student"] });
