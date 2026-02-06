import { withAuth } from "@/lib/withAuth";
import TeacherClassroomDetail from "@/pages/dashboard/teacher/TeacherClassroomDetail";

export default withAuth(TeacherClassroomDetail, { allowedRoles: ["teacher"] });
