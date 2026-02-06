import { withAuth } from "@/lib/withAuth";
import TeacherSyllabusLessonPlanner from "@/pages/dashboard/teacher/TeacherSyllabusLessonPlanner";

export default withAuth(TeacherSyllabusLessonPlanner, { allowedRoles: ["teacher"] });
