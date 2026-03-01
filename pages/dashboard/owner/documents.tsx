import { withAuth } from "@/lib/withAuth";
import OwnerDocumentsList from "@/features/dashboard/owner/OwnerDocumentsList";

export default withAuth(OwnerDocumentsList, { allowedRoles: ["admin"] });
