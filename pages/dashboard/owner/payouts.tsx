import { withAuth } from "@/lib/withAuth";
import OwnerPayouts from "@/features/dashboard/owner/OwnerPayouts";

export default withAuth(OwnerPayouts, { allowedRoles: ["admin"] });
