import { withAuth } from "@/lib/withAuth";
import Calendar from "@/features/dashboard/Calendar";

export default withAuth(Calendar, { allowedRoles: ["teacher"] });
