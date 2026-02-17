import { withAuth } from "@/lib/withAuth";
import TeacherAIStudioOutput from "@/features/dashboard/teacher/TeacherAIStudioOutput";

export default withAuth(TeacherAIStudioOutput, { allowedRoles: ["teacher"] });
