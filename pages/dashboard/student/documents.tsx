import { withAuth } from "@/lib/withAuth";
import StudentDocuments from "@/features/dashboard/student/StudentDocuments";

export default withAuth(StudentDocuments, { allowedRoles: ["student"] });
