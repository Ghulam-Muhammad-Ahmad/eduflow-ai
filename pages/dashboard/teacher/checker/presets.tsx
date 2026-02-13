import { withAuth } from "@/lib/withAuth";
import TeacherCheckerPresets from "@/features/dashboard/teacher/TeacherCheckerPresets";

export default withAuth(TeacherCheckerPresets, { allowedRoles: ["teacher"] });
