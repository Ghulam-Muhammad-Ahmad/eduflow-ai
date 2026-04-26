import { withAuth } from "@/lib/withAuth";
import OwnerDashboardEnhanced from "@/features/dashboard/owner/OwnerDashboardEnhanced";

export default withAuth(OwnerDashboardEnhanced, { allowedRoles: ["admin"] });
