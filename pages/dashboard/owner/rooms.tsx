import { withAuth } from "@/lib/withAuth";
import OwnerOneToOneRoomsList from "@/features/dashboard/owner/OwnerOneToOneRoomsList";

export default withAuth(OwnerOneToOneRoomsList, { allowedRoles: ["admin"] });
