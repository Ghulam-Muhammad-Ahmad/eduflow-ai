import { withAuth } from "@/lib/withAuth";
import TeacherDocuments from "@/pages/dashboard/TeacherDocuments";

export default withAuth(TeacherDocuments, { allowedRoles: ["teacher"] });
