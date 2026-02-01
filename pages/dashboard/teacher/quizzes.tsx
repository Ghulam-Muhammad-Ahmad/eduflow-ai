import { withAuth } from "@/lib/withAuth";
import TeacherQuizzes from "@/pages/dashboard/TeacherQuizzes";

export default withAuth(TeacherQuizzes, { allowedRoles: ["teacher"] });
