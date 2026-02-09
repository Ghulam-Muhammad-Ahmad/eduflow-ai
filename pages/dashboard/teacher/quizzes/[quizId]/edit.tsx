import { withAuth } from "@/lib/withAuth";
import TeacherQuizBuilder from "@/features/dashboard/teacher/TeacherQuizBuilder";

export default withAuth(TeacherQuizBuilder, { allowedRoles: ["teacher"] });
