import { useEffect } from "react";
import { useRouter } from "next/router";
import { withAuth } from "@/lib/withAuth";

function RedirectToStudents() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/teacher/students");
  }, [router]);
  return null;
}

export default withAuth(RedirectToStudents, { allowedRoles: ["teacher"] });
