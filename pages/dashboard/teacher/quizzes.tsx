import { withAuth } from "@/lib/withAuth";
import TeacherQuizzes from "@/features/dashboard/teacher/TeacherQuizzes";

export default withAuth(TeacherQuizzes, { allowedRoles: ["teacher"] });
