import { withAuth } from "@/lib/withAuth";
import AdminDashboard from "@/pages/dashboard/AdminDashboard";

export default withAuth(AdminDashboard, { allowedRoles: ["admin"] });
