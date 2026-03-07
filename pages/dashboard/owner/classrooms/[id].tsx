import { withAuth } from "@/lib/withAuth";
import OwnerClassroomDetail from "@/features/dashboard/owner/OwnerClassroomDetail";

export default withAuth(OwnerClassroomDetail, { allowedRoles: ["admin"] });
