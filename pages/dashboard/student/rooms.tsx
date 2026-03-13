import { withAuth } from "@/lib/withAuth";
import StudentOneToOneRoomsList from "@/features/dashboard/student/StudentOneToOneRoomsList";

export default withAuth(StudentOneToOneRoomsList, { allowedRoles: ["student"] });
