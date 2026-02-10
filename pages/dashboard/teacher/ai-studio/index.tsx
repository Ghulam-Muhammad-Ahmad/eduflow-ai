import { withAuth } from "@/lib/withAuth";
import TeacherAIStudioHub from "@/features/dashboard/teacher/TeacherAIStudioHub";

export default withAuth(TeacherAIStudioHub, { allowedRoles: ["teacher"] });
