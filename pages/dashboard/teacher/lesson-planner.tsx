import { withAuth } from "@/lib/withAuth";
import TeacherSyllabusLessonPlanner from "@/pages/dashboard/TeacherSyllabusLessonPlanner";

export default withAuth(TeacherSyllabusLessonPlanner, { allowedRoles: ["teacher"] });
