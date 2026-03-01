import { withAuth } from "@/lib/withAuth";
import OwnerStudentsList from "@/features/dashboard/owner/OwnerStudentsList";

export default withAuth(OwnerStudentsList, { allowedRoles: ["admin"] });
