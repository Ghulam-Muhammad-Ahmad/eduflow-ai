import { withAuth } from "@/lib/withAuth";
import TeacherQuizResults from "@/features/dashboard/teacher/TeacherQuizResults";

export default withAuth(TeacherQuizResults, { allowedRoles: ["teacher"] });
