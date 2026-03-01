import { withAuth } from "@/lib/withAuth";
import TeacherBilling from "@/features/dashboard/teacher/TeacherBilling";

export default withAuth(TeacherBilling, { allowedRoles: ["teacher"] });
