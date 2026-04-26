import { withAuth } from "@/lib/withAuth";
import OwnerEvaluationsHub from "@/features/dashboard/owner/OwnerEvaluationsHub";

export default withAuth(OwnerEvaluationsHub, { allowedRoles: ["admin"] });
