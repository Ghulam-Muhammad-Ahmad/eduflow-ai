import OwnerContractNew from "@/features/dashboard/owner/OwnerContractNew";
import { withAuth } from "@/lib/withAuth";

function NewContractPage() {
  return <OwnerContractNew />;
}

export default withAuth(NewContractPage, { allowedRoles: ["admin"] });
