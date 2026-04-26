import { withAuth } from "@/lib/withAuth";
import OwnerTutorMatchingHub from "@/features/dashboard/owner/OwnerTutorMatchingHub";

export default withAuth(OwnerTutorMatchingHub, { allowedRoles: ["admin"] });
