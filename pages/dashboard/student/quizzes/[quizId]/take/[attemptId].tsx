import { withAuth } from "@/lib/withAuth";
import StudentQuizTake from "@/features/dashboard/student/StudentQuizTake";

export default withAuth(StudentQuizTake, { allowedRoles: ["student"] });
