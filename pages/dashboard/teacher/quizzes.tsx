import { withAuth } from "@/lib/withAuth";
import TeacherQuizzes from "@/pages/dashboard/teacher/TeacherQuizzes";

export default withAuth(TeacherQuizzes, { allowedRoles: ["teacher"] });
