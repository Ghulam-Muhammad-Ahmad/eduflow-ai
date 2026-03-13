import { withAuth } from "@/lib/withAuth";
import OwnerStudentRecords from "@/features/dashboard/owner/OwnerStudentRecords";

export default withAuth(OwnerStudentRecords, { allowedRoles: ["admin"] });
