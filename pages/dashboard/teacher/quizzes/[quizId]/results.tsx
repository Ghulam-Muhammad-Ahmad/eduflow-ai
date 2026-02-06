import { withAuth } from "@/lib/withAuth";
import TeacherQuizResults from "@/pages/dashboard/teacher/TeacherQuizResults";

export default withAuth(TeacherQuizResults, { allowedRoles: ["teacher"] });
