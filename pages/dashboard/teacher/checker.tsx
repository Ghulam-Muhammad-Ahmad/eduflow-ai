import { withAuth } from "@/lib/withAuth";
import TeacherAIChecker from "@/features/dashboard/teacher/TeacherAIChecker";

export default withAuth(TeacherAIChecker, { allowedRoles: ["teacher"] });
