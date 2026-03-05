import TeacherMyProfile from "@/features/dashboard/teacher/TeacherMyProfile";
import { withAuth } from "@/lib/withAuth";

function TeacherProfilePage() {
  return <TeacherMyProfile />;
}

export default withAuth(TeacherProfilePage, { allowedRoles: ["teacher"] });
