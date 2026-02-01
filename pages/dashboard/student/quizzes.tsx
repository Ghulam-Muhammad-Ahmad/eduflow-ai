import { withAuth } from "@/lib/withAuth";
import StudentQuizzes from "@/pages/dashboard/StudentQuizzes";

export default withAuth(StudentQuizzes, { allowedRoles: ["student"] });
