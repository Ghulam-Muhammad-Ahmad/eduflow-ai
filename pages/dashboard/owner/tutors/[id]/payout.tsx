import { withAuth } from "@/lib/withAuth";
import OwnerTutorPayout from "@/features/dashboard/owner/OwnerTutorPayout";

export default withAuth(OwnerTutorPayout, { allowedRoles: ["admin"] });
