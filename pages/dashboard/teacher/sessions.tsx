import { withAuth } from "@/lib/withAuth";
import TeacherSessions from "@/features/dashboard/teacher/TeacherSessions";

export default withAuth(TeacherSessions, { allowedRoles: ["teacher"] });
