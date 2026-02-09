import { withAuth } from "@/lib/withAuth";
import TeacherClassrooms from "@/features/dashboard/teacher/TeacherClassrooms";

export default withAuth(TeacherClassrooms, { allowedRoles: ["teacher"] });
