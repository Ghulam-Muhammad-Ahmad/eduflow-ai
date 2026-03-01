import { withAuth } from "@/lib/withAuth";
import StudentBilling from "@/features/dashboard/student/StudentBilling";

export default withAuth(StudentBilling, { allowedRoles: ["student"] });
