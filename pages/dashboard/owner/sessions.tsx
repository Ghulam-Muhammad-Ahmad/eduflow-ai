import { withAuth } from "@/lib/withAuth";
import OwnerSessions from "@/features/dashboard/owner/OwnerSessions";

export default withAuth(OwnerSessions, { allowedRoles: ["admin"] });
