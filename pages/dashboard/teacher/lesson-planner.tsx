import { withAuth } from "@/lib/withAuth";
import TeacherSyllabusLessonPlanner from "@/features/dashboard/teacher/TeacherSyllabusLessonPlanner";

export default withAuth(TeacherSyllabusLessonPlanner, { allowedRoles: ["teacher"] });
