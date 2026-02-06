import { withAuth } from "@/lib/withAuth";
import StudentClassroomDetail from "@/pages/dashboard/student/StudentClassroomDetail";

export default withAuth(StudentClassroomDetail, { allowedRoles: ["student"] });
