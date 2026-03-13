import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useOneToOneRooms } from "@/hooks/useOneToOneRooms";
import { useAssignments } from "@/hooks/useAssignments";
import { useQuizzes } from "@/hooks/useQuizzes";
import { Button } from "@/components/ui/button";
import { User, FileText, Video } from "lucide-react";
import OneToOneRoomDetailContent from "@/features/dashboard/shared/OneToOneRoomDetailContent";

const TeacherOneToOneRoomDetail = () => {
  const router = useRouter();
  const { roomId } = router.query as { roomId: string };
  const { oneToOneRooms, isLoading: roomsLoading } = useOneToOneRooms();
  const { assignments, isLoading: assignmentsLoading } = useAssignments(undefined, roomId || undefined);
  const { fetchOneToOneRoomQuizzes } = useQuizzes();
  const [roomQuizzes, setRoomQuizzes] = useState<Array<{ id: string; title: string; status: string }>>([]);
  const [quizzesLoading, setQuizzesLoading] = useState(false);

  const room = oneToOneRooms?.find((r) => r.id === roomId);

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    setQuizzesLoading(true);
    fetchOneToOneRoomQuizzes(roomId)
      .then((data) => {
        if (!cancelled) setRoomQuizzes(data ?? []);
      })
      .finally(() => {
        if (!cancelled) setQuizzesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [roomId, fetchOneToOneRoomQuizzes]);

  if (!room && !roomsLoading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-16">
          <User className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">1v1 Room Not Found</h2>
          <p className="text-muted-foreground mb-6">
            This room doesn&apos;t exist or you don&apos;t have access to it.
          </p>
          <Button onClick={() => router.push("/dashboard/teacher/rooms")}>
            Back to 1v1 Rooms
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  if (!room) {
    return null;
  }

  const roomTitle = room.name || `${room.studentProfile?.display_name ?? "Student"} (1v1)`;
  const studentName = room.studentProfile?.display_name ?? room.studentProfile?.email ?? "Student";

  return (
    <OneToOneRoomDetailContent
      room={room}
      backHref="/dashboard/teacher/rooms"
      title={roomTitle}
      subtitle={`1v1 room with ${studentName}`}
      headerActions={
        <>
          <Button asChild variant="outline" className="gap-2">
            <Link
              href={
                roomId && room.student_id
                  ? `/dashboard/teacher/sessions?studentId=${room.student_id}&scope=one_to_one`
                  : "/dashboard/teacher/sessions"
              }
            >
              <Video className="w-4 h-4" />
              View sessions
            </Link>
          </Button>
          <Button
            onClick={() =>
              roomId && router.push(`/dashboard/teacher/student-records/${room.student_id}?roomId=${roomId}`)
            }
            className="gap-2"
          >
            <FileText className="w-4 h-4" />
            View room report
          </Button>
        </>
      }
      assignments={assignments ?? []}
      assignmentsLoading={assignmentsLoading}
      quizzes={roomQuizzes}
      quizzesLoading={quizzesLoading}
      viewRecordHref={`/dashboard/teacher/student-records/${room.student_id}?roomId=${roomId}`}
      variant="teacher"
    />
  );
};

export default TeacherOneToOneRoomDetail;
