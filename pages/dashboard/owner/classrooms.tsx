import { withAuth } from "@/lib/withAuth";
import OwnerClassroomsList from "@/features/dashboard/owner/OwnerClassroomsList";

export default withAuth(OwnerClassroomsList, { allowedRoles: ["admin"] });
