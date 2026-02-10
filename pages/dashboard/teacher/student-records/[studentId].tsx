import { withAuth } from "@/lib/withAuth";
import TeacherStudentRecordPage from "@/features/dashboard/teacher/TeacherStudentRecordPage";

export default withAuth(TeacherStudentRecordPage, { allowedRoles: ["teacher"] });
