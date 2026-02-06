import { withAuth } from "@/lib/withAuth";
import TeacherQuizBuilder from "@/pages/dashboard/teacher/TeacherQuizBuilder";

export default withAuth(TeacherQuizBuilder, { allowedRoles: ["teacher"] });
