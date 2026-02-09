import { withAuth } from "@/lib/withAuth";
import TeacherAIStudio from "@/features/dashboard/teacher/TeacherAIStudio";

export default withAuth(TeacherAIStudio, { allowedRoles: ["teacher"] });
