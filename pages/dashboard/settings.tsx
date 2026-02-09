import { withAuth } from "@/lib/withAuth";
import Settings from "@/features/dashboard/Settings";

export default withAuth(Settings, { allowedRoles: ["teacher", "student", "admin"] });
