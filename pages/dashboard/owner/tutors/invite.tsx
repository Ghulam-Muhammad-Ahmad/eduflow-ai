import { withAuth } from "@/lib/withAuth";
import OwnerInviteTutor from "@/features/dashboard/owner/OwnerInviteTutor";

export default withAuth(OwnerInviteTutor, { allowedRoles: ["admin"] });
