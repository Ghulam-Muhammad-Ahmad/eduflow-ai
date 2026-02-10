import { withAuth } from "@/lib/withAuth";
import TeacherAIStudioSmartTutor from "@/features/dashboard/teacher/TeacherAIStudioSmartTutor";

export default withAuth(TeacherAIStudioSmartTutor, { allowedRoles: ["teacher"] });
