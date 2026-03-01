import { withAuth } from "@/lib/withAuth";
import OwnerTutorsList from "@/features/dashboard/owner/OwnerTutorsList";

export default withAuth(OwnerTutorsList, { allowedRoles: ["admin"] });
