import { withAuth } from "@/lib/withAuth";
import StudentAIPrep from "@/features/dashboard/student/StudentAIPrep";

export default withAuth(StudentAIPrep, { allowedRoles: ["student"] });
