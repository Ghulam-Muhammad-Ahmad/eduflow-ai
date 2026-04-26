import { withAuth } from "@/lib/withAuth";
import TeacherEvaluation from "@/features/dashboard/teacher/TeacherEvaluation";

export default withAuth(TeacherEvaluation, { allowedRoles: ["teacher"] });
