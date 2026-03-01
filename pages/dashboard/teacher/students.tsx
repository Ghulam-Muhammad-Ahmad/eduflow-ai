import { withAuth } from "@/lib/withAuth";
import TeacherStudentsList from "@/features/dashboard/teacher/TeacherStudentsList";

export default withAuth(TeacherStudentsList, { allowedRoles: ["teacher"] });
