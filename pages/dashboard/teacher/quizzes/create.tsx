import { withAuth } from "@/lib/withAuth";
import TeacherQuizBuilder from "@/pages/dashboard/TeacherQuizBuilder";

export default withAuth(TeacherQuizBuilder, { allowedRoles: ["teacher"] });
