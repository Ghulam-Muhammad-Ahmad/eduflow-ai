import { withAuth } from "@/lib/withAuth";
import TeacherClassroomDetail from "@/features/dashboard/teacher/TeacherClassroomDetail";

export default withAuth(TeacherClassroomDetail, { allowedRoles: ["teacher"] });
