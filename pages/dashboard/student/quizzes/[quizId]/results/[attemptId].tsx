import { withAuth } from "@/lib/withAuth";
import StudentQuizResults from "@/features/dashboard/student/StudentQuizResults";

export default withAuth(StudentQuizResults, { allowedRoles: ["student"] });
