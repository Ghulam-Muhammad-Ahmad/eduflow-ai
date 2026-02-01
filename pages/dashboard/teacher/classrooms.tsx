import { withAuth } from "@/lib/withAuth";
import TeacherClassrooms from "@/pages/dashboard/TeacherClassrooms";

export default withAuth(TeacherClassrooms, { allowedRoles: ["teacher"] });
