import { withAuth } from "@/lib/withAuth";
import OwnerAssignmentsList from "@/features/dashboard/owner/OwnerAssignmentsList";

export default withAuth(OwnerAssignmentsList, { allowedRoles: ["admin"] });
