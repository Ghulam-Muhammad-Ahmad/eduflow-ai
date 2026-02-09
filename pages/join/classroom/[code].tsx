import { useRouter } from "next/router";
import JoinClassroom from "@/features/JoinClassroom";

export default function JoinClassroomPage() {
  const router = useRouter();
  const { code } = router.query;

  return <JoinClassroom />;
}
