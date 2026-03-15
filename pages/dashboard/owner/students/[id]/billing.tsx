import { withAuth } from "@/lib/withAuth";
import OwnerStudentBilling from "@/features/dashboard/owner/OwnerStudentBilling";

export default withAuth(OwnerStudentBilling, { allowedRoles: ["admin"] });
