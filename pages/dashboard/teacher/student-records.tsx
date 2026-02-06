import { withAuth } from "@/lib/withAuth";
import TeacherStudentRecords from "@/pages/dashboard/teacher/TeacherStudentRecords";

export default withAuth(TeacherStudentRecords, { allowedRoles: ["teacher"] });
