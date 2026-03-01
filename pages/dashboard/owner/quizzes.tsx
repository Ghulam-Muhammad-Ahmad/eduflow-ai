import { withAuth } from "@/lib/withAuth";
import OwnerQuizzesList from "@/features/dashboard/owner/OwnerQuizzesList";

export default withAuth(OwnerQuizzesList, { allowedRoles: ["admin"] });
