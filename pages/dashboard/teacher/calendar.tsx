import { withAuth } from "@/lib/withAuth";
import Calendar from "@/pages/dashboard/Calendar";

export default withAuth(Calendar, { allowedRoles: ["teacher"] });
