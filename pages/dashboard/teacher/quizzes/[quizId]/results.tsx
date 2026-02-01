import { withAuth } from "@/lib/withAuth";
import TeacherQuizResults from "@/pages/dashboard/TeacherQuizResults";

export default withAuth(TeacherQuizResults, { allowedRoles: ["teacher"] });
