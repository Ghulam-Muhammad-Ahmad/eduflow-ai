import { withAuth } from "@/lib/withAuth";
import TeacherStudentRecords from "@/features/dashboard/teacher/TeacherStudentRecords";

export default withAuth(TeacherStudentRecords, { allowedRoles: ["teacher"] });
