import { withAuth } from "@/lib/withAuth";
import TeacherAIStudio from "@/pages/dashboard/TeacherAIStudio";

export default withAuth(TeacherAIStudio, { allowedRoles: ["teacher"] });
