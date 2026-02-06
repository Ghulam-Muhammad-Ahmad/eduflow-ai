import { withAuth } from "@/lib/withAuth";
import StudentQuizTake from "@/pages/dashboard/student/StudentQuizTake";

export default withAuth(StudentQuizTake, { allowedRoles: ["student"] });
