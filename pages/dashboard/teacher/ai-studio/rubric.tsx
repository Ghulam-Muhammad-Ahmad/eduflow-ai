import { withAuth } from "@/lib/withAuth";
import TeacherAIStudioRubric from "@/features/dashboard/teacher/TeacherAIStudioRubric";

export default withAuth(TeacherAIStudioRubric, { allowedRoles: ["teacher"] });
