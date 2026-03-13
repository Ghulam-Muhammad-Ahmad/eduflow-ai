import { withAuth } from "@/lib/withAuth";
import OwnerStudentRecordPage from "@/features/dashboard/owner/OwnerStudentRecordPage";

export default withAuth(OwnerStudentRecordPage, { allowedRoles: ["admin"] });
