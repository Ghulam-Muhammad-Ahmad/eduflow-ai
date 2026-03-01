import { withAuth } from "@/lib/withAuth";
import OwnerBilling from "@/features/dashboard/owner/OwnerBilling";

export default withAuth(OwnerBilling, { allowedRoles: ["admin"] });
