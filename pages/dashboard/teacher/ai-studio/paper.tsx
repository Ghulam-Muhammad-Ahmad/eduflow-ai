import { withAuth } from "@/lib/withAuth";
import TeacherAIStudioPaper from "@/features/dashboard/teacher/TeacherAIStudioPaper";

export default withAuth(TeacherAIStudioPaper, { allowedRoles: ["teacher"] });
