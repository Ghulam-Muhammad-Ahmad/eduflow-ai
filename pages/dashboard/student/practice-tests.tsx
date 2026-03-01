import { withAuth } from "@/lib/withAuth";
import StudentPracticeTests from "@/features/dashboard/student/StudentPracticeTests";

export default withAuth(StudentPracticeTests, { allowedRoles: ["student"] });
