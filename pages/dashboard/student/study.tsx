import { withAuth } from "@/lib/withAuth";
import StudentAIPrep from "@/pages/dashboard/student/StudentAIPrep";

export default withAuth(StudentAIPrep, { allowedRoles: ["student"] });
