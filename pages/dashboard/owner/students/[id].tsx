import { withAuth } from "@/lib/withAuth";
import OwnerStudentProfile from "@/features/dashboard/owner/OwnerStudentProfile";

export default withAuth(OwnerStudentProfile, { allowedRoles: ["admin"] });
