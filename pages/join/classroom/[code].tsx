import { useEffect } from "react";
import { useRouter } from "next/router";

/** Join-by-code is no longer used; redirect to student dashboard. */
export default function JoinClassroomByCodePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/student");
  }, [router]);

  return null;
}
