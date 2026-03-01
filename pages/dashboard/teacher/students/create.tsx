import { withAuth } from "@/lib/withAuth";
import TeacherCreateStudent from "@/features/dashboard/teacher/TeacherCreateStudent";

export default withAuth(TeacherCreateStudent, { allowedRoles: ["teacher"] });
