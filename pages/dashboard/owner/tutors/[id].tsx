import { withAuth } from "@/lib/withAuth";
import OwnerTutorProfile from "@/features/dashboard/owner/OwnerTutorProfile";

export default withAuth(OwnerTutorProfile, { allowedRoles: ["admin"] });
