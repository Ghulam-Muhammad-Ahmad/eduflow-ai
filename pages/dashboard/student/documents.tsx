import { withAuth } from "@/lib/withAuth";
import StudentDocuments from "@/pages/dashboard/student/StudentDocuments";

export default withAuth(StudentDocuments, { allowedRoles: ["student"] });
