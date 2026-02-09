import { withAuth } from "@/lib/withAuth";
import AdminDashboard from "@/features/dashboard/AdminDashboard";

export default withAuth(AdminDashboard, { allowedRoles: ["admin"] });
