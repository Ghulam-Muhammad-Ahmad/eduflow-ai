import { withAuth } from "@/lib/withAuth";
import StudentCourseMaterials from "@/pages/dashboard/student/StudentCourseMaterials";

export default withAuth(StudentCourseMaterials, { allowedRoles: ["student"] });
