import { withAuth } from "@/lib/withAuth";
import StudentQuizzes from "@/pages/dashboard/student/StudentQuizzes";

export default withAuth(StudentQuizzes, { allowedRoles: ["student"] });
