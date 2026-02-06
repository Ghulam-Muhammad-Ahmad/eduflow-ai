import { withAuth } from "@/lib/withAuth";
import TeacherAIChecker from "@/pages/dashboard/teacher/TeacherAIChecker";

export default withAuth(TeacherAIChecker, { allowedRoles: ["teacher"] });
