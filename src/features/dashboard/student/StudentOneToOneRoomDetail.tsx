import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useQuery } from "@tanstack/react-query";
import { startOfWeek, subWeeks, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User } from "lucide-react";
import OneToOneRoomDetailContent from "@/features/dashboard/shared/OneToOneRoomDetailContent";
import { useOneToOneRooms } from "@/hooks/useOneToOneRooms";
import { useStudentAssignments } from "@/hooks/useAssignments";
import { useStudentAllLectureSessions } from "@/hooks/useLectureSessions";
import { useQuizzes, type Quiz } from "@/hooks/useQuizzes";

export default function StudentOneToOneRoomDetail() {
  const router = useRouter();
  const { roomId } = router.query as { roomId: string };
  const { user } = useAuth();
  const { oneToOneRooms, isLoading } = useOneToOneRooms();
  const room = oneToOneRooms.find((r) => r.id === roomId);

  const { data: assignments = [], isLoading: assignmentsLoading } = useStudentAssignments(
    undefined,
    roomId
  );

  const { fetchStudentQuizzes } = useQuizzes();
  const [allQuizzes, setAllQuizzes] = useState<Quiz[]>([]);
  const [quizzesLoading, setQuizzesLoading] = useState(true);
  useEffect(() => {
    if (!user?.id) return;
    setQuizzesLoading(true);
    fetchStudentQuizzes(user.id).then((data) => {
      setAllQuizzes(data);
      setQuizzesLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
  const roomQuizzes = useMemo(
    () =>
      allQuizzes
        .filter((q) => q.one_to_one_room_id === roomId)
        .map((q) => ({ id: q.id, title: q.title, status: q.status })),
    [allQuizzes, roomId]
  );
  const roomQuizIds = useMemo(() => roomQuizzes.map((q) => q.id), [roomQuizzes]);

  const { data: allSessions = [] } = useStudentAllLectureSessions();
  const roomSessions = useMemo(() => {
    if (!room) return [];
    return allSessions.filter(
      (s) => (s as { scope_type?: string }).scope_type === "one_to_one" && s.tutor_id === room.tutor_id
    );
  }, [room, allSessions]);

  const roomAssignmentIds = useMemo(() => assignments.map((a) => a.id), [assignments]);
  const { data: roomSubmissions = [] } = useQuery({
    queryKey: ["student-one-to-one-room-submissions", roomId, roomAssignmentIds, user?.id],
    queryFn: async () => {
      if (!user?.id || roomAssignmentIds.length === 0) return [];
      const { data, error } = await supabase
        .from("submissions")
        .select("id, submitted_at")
        .eq("student_id", user.id)
        .in("assignment_id", roomAssignmentIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id && roomAssignmentIds.length > 0,
  });

  const { data: roomQuizAttempts = [] } = useQuery({
    queryKey: ["student-one-to-one-room-quiz-attempts", roomId, roomQuizIds, user?.id],
    queryFn: async () => {
      if (!user?.id || roomQuizIds.length === 0) return [];
      const { data, error } = await supabase
        .from("quiz_attempts")
        .select("id, submitted_at")
        .eq("student_id", user.id)
        .in("quiz_id", roomQuizIds)
        .not("submitted_at", "is", null);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id && roomQuizIds.length > 0,
  });

  const activityTimeline = useMemo(() => {
    const weeks: { week: string; sessions: number; submissions: number; quizzes: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const sessionsCount = roomSessions.filter((s) => {
        const d =
          s.status === "completed"
            ? new Date((s as { ends_at?: string }).ends_at ?? s.starts_at)
            : new Date(s.starts_at);
        return d >= weekStart && d < weekEnd;
      }).length;
      const submissionsCount = roomSubmissions.filter((s) => {
        const d = new Date((s as { submitted_at: string }).submitted_at);
        return d >= weekStart && d < weekEnd;
      }).length;
      const quizzesCount = roomQuizAttempts.filter((q) => {
        const subAt = (q as { submitted_at?: string | null }).submitted_at;
        if (!subAt) return false;
        const d = new Date(subAt);
        return d >= weekStart && d < weekEnd;
      }).length;
      weeks.push({
        week: format(weekStart, "d MMM"),
        sessions: sessionsCount,
        submissions: submissionsCount,
        quizzes: quizzesCount,
      });
    }
    return weeks;
  }, [roomSessions, roomSubmissions, roomQuizAttempts]);

  const sessionsAnalytics = useMemo(
    () => ({
      completed: roomSessions.filter((s) => s.status === "completed").length,
      scheduled: roomSessions.filter((s) => s.status === "scheduled").length,
    }),
    [roomSessions]
  );

  if (!room && !isLoading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-16">
          <User className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">1v1 Room Not Found</h2>
          <p className="text-muted-foreground mb-6">
            This room doesn&apos;t exist or you don&apos;t have access to it.
          </p>
          <Button onClick={() => router.push("/dashboard/student/rooms")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to 1v1 Rooms
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  if (!room) return null;

  const roomTitle = room.name || "1v1 room";
  const tutorName = room.tutorProfile?.display_name ?? "Tutor";

  return (
    <OneToOneRoomDetailContent
      room={room}
      backHref="/dashboard/student/rooms"
      title={roomTitle}
      subtitle={tutorName}
      headerActions={null}
      assignments={assignments.map((a) => ({
        id: a.id,
        title: a.title,
        status: a.status,
        due_date: a.due_date,
        points_possible: a.points_possible,
      }))}
      assignmentsLoading={assignmentsLoading}
      quizzes={roomQuizzes}
      quizzesLoading={quizzesLoading}
      viewRecordHref="/dashboard/student/progress"
      variant="student"
      activityTimeline={activityTimeline}
      sessionsAnalytics={sessionsAnalytics}
    />
  );
}
