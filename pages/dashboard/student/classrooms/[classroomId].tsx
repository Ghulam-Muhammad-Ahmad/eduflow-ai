import { withAuth } from "@/lib/withAuth";
import StudentClassroomDetail from "@/features/dashboard/student/StudentClassroomDetail";

export default withAuth(StudentClassroomDetail, { allowedRoles: ["student"] });
