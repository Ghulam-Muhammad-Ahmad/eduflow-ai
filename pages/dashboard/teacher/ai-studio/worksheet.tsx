import { withAuth } from "@/lib/withAuth";
import TeacherAIStudioWorksheet from "@/features/dashboard/teacher/TeacherAIStudioWorksheet";

export default withAuth(TeacherAIStudioWorksheet, { allowedRoles: ["teacher"] });
