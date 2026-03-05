import OwnerContractsList from "@/features/dashboard/owner/OwnerContractsList";
import { withAuth } from "@/lib/withAuth";

function OwnerContractsPage() {
  return <OwnerContractsList />;
}

export default withAuth(OwnerContractsPage, { allowedRoles: ["admin"] });
