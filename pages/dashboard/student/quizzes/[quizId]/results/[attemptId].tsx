import { withAuth } from "@/lib/withAuth";
import StudentQuizResults from "@/pages/dashboard/StudentQuizResults";

export default withAuth(StudentQuizResults, { allowedRoles: ["student"] });
