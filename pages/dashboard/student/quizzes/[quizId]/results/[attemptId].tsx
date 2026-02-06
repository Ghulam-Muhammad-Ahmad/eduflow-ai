import { withAuth } from "@/lib/withAuth";
import StudentQuizResults from "@/pages/dashboard/student/StudentQuizResults";

export default withAuth(StudentQuizResults, { allowedRoles: ["student"] });
