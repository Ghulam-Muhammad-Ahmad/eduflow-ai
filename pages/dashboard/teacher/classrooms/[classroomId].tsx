import { withAuth } from "@/lib/withAuth";
import TeacherClassroomDetail from "@/pages/dashboard/TeacherClassroomDetail";

export default withAuth(TeacherClassroomDetail, { allowedRoles: ["teacher"] });
