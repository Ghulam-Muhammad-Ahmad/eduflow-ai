import { withAuth } from "@/lib/withAuth";
import TeacherStudentRecords from "@/pages/dashboard/TeacherStudentRecords";

export default withAuth(TeacherStudentRecords, { allowedRoles: ["teacher"] });
