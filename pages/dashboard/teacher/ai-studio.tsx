import { withAuth } from "@/lib/withAuth";
import TeacherAIStudio from "@/pages/dashboard/teacher/TeacherAIStudio";

export default withAuth(TeacherAIStudio, { allowedRoles: ["teacher"] });
