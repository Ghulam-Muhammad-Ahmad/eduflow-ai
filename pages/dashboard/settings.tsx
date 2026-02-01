import { withAuth } from "@/lib/withAuth";
import Settings from "@/pages/dashboard/Settings";

export default withAuth(Settings, { allowedRoles: ["teacher", "student", "admin"] });
