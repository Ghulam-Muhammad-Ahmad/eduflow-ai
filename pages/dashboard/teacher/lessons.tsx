import { withAuth } from "@/lib/withAuth";
import TeacherLessonPlanner from "@/pages/dashboard/TeacherLessonPlanner";

export default withAuth(TeacherLessonPlanner, { allowedRoles: ["teacher"] });
