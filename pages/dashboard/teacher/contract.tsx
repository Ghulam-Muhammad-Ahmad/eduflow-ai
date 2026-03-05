import TeacherContract from "@/features/dashboard/teacher/TeacherContract";
import { withAuth } from "@/lib/withAuth";

function TeacherContractPage() {
  return <TeacherContract />;
}

export default withAuth(TeacherContractPage, { allowedRoles: ["teacher"] });
