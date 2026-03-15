import { withAuth } from "@/lib/withAuth";
import OwnerStudentBillingSetup from "@/features/dashboard/owner/OwnerStudentBillingSetup";

export default withAuth(OwnerStudentBillingSetup, { allowedRoles: ["admin"] });
