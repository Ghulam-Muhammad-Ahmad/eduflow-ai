import { withAuth } from "@/lib/withAuth";
import OwnerFinanceDashboard from "@/features/dashboard/owner/OwnerFinanceDashboard";

export default withAuth(OwnerFinanceDashboard, { allowedRoles: ["admin"] });
