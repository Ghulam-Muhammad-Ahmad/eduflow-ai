import { withAuth } from "@/lib/withAuth";
import TeacherOneToOneRoomsList from "@/features/dashboard/teacher/TeacherOneToOneRoomsList";

export default withAuth(TeacherOneToOneRoomsList, { allowedRoles: ["teacher"] });
