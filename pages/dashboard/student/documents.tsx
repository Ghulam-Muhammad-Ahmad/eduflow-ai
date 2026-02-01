import { withAuth } from "@/lib/withAuth";
import StudentDocuments from "@/pages/dashboard/StudentDocuments";

export default withAuth(StudentDocuments, { allowedRoles: ["student"] });
