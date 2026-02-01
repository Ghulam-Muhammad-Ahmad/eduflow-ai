import { withAuth } from "@/lib/withAuth";
import TeacherAIGrading from "@/pages/dashboard/TeacherAIGrading";

export default withAuth(TeacherAIGrading, { allowedRoles: ["teacher"] });
