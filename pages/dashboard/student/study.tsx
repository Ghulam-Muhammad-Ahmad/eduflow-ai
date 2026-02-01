import { withAuth } from "@/lib/withAuth";
import StudentAIPrep from "@/pages/dashboard/StudentAIPrep";

export default withAuth(StudentAIPrep, { allowedRoles: ["student"] });
