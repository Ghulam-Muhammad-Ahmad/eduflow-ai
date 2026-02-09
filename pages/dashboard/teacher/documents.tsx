import { withAuth } from "@/lib/withAuth";
import TeacherDocuments from "@/features/dashboard/teacher/TeacherDocuments";

export default withAuth(TeacherDocuments, { allowedRoles: ["teacher"] });
