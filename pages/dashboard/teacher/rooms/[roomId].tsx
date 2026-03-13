import { withAuth } from "@/lib/withAuth";
import TeacherOneToOneRoomDetail from "@/features/dashboard/teacher/TeacherOneToOneRoomDetail";

export default withAuth(TeacherOneToOneRoomDetail, { allowedRoles: ["teacher"] });
