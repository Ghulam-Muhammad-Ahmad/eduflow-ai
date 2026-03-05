import OwnerContractDetail from "@/features/dashboard/owner/OwnerContractDetail";
import { withAuth } from "@/lib/withAuth";

function ContractDetailPage() {
  return <OwnerContractDetail />;
}

export default withAuth(ContractDetailPage, { allowedRoles: ["admin"] });
