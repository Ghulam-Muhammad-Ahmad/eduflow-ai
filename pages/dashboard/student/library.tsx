import { withAuth } from "@/lib/withAuth";
import StudentMyLibrary from "@/features/dashboard/student/StudentMyLibrary";

export default withAuth(StudentMyLibrary, { allowedRoles: ["student"] });
