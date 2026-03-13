import { withAuth } from "@/lib/withAuth";
import OwnerOneToOneRoomDetail from "@/features/dashboard/owner/OwnerOneToOneRoomDetail";

export default withAuth(OwnerOneToOneRoomDetail, { allowedRoles: ["admin"] });
