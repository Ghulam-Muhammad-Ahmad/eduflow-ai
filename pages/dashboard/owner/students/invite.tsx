import { withAuth } from "@/lib/withAuth";
import OwnerInviteStudent from "@/features/dashboard/owner/OwnerInviteStudent";

export default withAuth(OwnerInviteStudent, { allowedRoles: ["admin"] });
