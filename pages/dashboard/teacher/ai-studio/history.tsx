import { withAuth } from "@/lib/withAuth";
import TeacherAIStudioHistory from "@/features/dashboard/teacher/TeacherAIStudioHistory";

export default withAuth(TeacherAIStudioHistory, { allowedRoles: ["teacher"] });
