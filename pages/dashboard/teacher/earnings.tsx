import { withAuth } from "@/lib/withAuth";
import TeacherEarnings from "@/features/dashboard/teacher/TeacherEarnings";

export default withAuth(TeacherEarnings, { allowedRoles: ["teacher"] });
