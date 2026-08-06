import { withAuth } from "@/lib/withAuth";
import StudentOneToOneRoomDetail from "@/features/dashboard/student/StudentOneToOneRoomDetail";

export default withAuth(StudentOneToOneRoomDetail, { allowedRoles: ["student"] });
