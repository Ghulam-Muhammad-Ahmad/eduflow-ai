import { withAuth } from "@/lib/withAuth";
import StudentCourseMaterials from "@/features/dashboard/student/StudentCourseMaterials";

export default withAuth(StudentCourseMaterials, { allowedRoles: ["student"] });
