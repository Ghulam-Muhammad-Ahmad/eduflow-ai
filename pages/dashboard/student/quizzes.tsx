import { withAuth } from "@/lib/withAuth";
import StudentQuizzes from "@/features/dashboard/student/StudentQuizzes";

export default withAuth(StudentQuizzes, { allowedRoles: ["student"] });
