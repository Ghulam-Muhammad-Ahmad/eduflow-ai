import { withAuth } from "@/lib/withAuth";
import TeacherDocuments from "@/pages/dashboard/teacher/TeacherDocuments";

export default withAuth(TeacherDocuments, { allowedRoles: ["teacher"] });
