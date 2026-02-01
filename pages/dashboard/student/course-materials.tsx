import { withAuth } from "@/lib/withAuth";
import StudentCourseMaterials from "@/pages/dashboard/StudentCourseMaterials";

export default withAuth(StudentCourseMaterials, { allowedRoles: ["student"] });
