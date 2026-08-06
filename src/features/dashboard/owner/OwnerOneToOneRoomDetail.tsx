import { useState, useMemo } from "react";
import { useRouter } from "next/router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useWorkspaceLectureSessions } from "@/hooks/useLectureSessions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, User, FileText, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import OneToOneRoomDetailContent from "@/features/dashboard/shared/OneToOneRoomDetailContent";
import type { OneToOneRoomRow } from "@/hooks/useOneToOneRooms";
import { startOfWeek, subWeeks, format } from "date-fns";

export default function OwnerOneToOneRoomDetail() {
  const router = useRouter();
  const { roomId } = router.query as { roomId: string };
  const {
    workspace,
    oneToOneRooms,
    assignments: workspaceAssignments,
    quizzes: workspaceQuizzes,
    assignmentsLoading,
    quizzesLoading,
    updateOneToOneRoom,
    deleteOneToOneRoom,
    isLoading,
  } = useOwnerWorkspace();
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const room = oneToOneRooms?.find((r) => r.id === roomId) as OneToOneRoomRow | undefined;

  const { data: workspaceSessions = [] } = useWorkspaceLectureSessions(workspace?.id ?? null);
  const roomSessions = useMemo(() => {
    if (!room) return [];
    return workspaceSessions.filter(
      (s) =>
        (s as { scope_type?: string }).scope_type === "one_to_one" &&
        s.student_id === room.student_id &&
        s.tutor_id === room.tutor_id
    );
  }, [room, workspaceSessions]);

  const roomAssignments = useMemo(() => {
    if (!roomId || !workspaceAssignments?.length) return [];
    return workspaceAssignments.filter((a) => (a as { one_to_one_room_id?: string | null }).one_to_one_room_id === roomId);
  }, [roomId, workspaceAssignments]);

  const roomAssignmentIds = useMemo(() => roomAssignments.map((a) => a.id), [roomAssignments]);
  const { data: roomSubmissions = [] } = useQuery({
    queryKey: ["owner-one-to-one-room-submissions", roomId, roomAssignmentIds],
    queryFn: async () => {
      if (roomAssignmentIds.length === 0) return [];
      const { data, error } = await supabase
        .from("submissions")
        .select("id, submitted_at")
        .in("assignment_id", roomAssignmentIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!roomId && roomAssignmentIds.length > 0,
  });

  const roomQuizzes = useMemo(() => {
    if (!roomId || !workspaceQuizzes?.length) return [];
    return workspaceQuizzes
      .filter((q) => (q as { one_to_one_room_id?: string | null }).one_to_one_room_id === roomId)
      .map((q) => ({ id: q.id, title: q.title ?? "", status: q.status ?? "draft" }));
  }, [roomId, workspaceQuizzes]);

  const roomQuizIds = useMemo(() => roomQuizzes.map((q) => q.id), [roomQuizzes]);
  const { data: roomQuizAttempts = [] } = useQuery({
    queryKey: ["owner-one-to-one-room-quiz-attempts", roomId, roomQuizIds],
    queryFn: async () => {
      if (roomQuizIds.length === 0) return [];
      const { data, error } = await supabase
        .from("quiz_attempts")
        .select("id, submitted_at")
        .in("quiz_id", roomQuizIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!roomId && roomQuizIds.length > 0,
  });

  const activityTimeline = useMemo(() => {
    const weeks: { week: string; sessions: number; submissions: number; quizzes: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const sessionsCount = roomSessions.filter((s) => {
        const d = s.status === "completed" ? new Date((s as { ends_at?: string }).ends_at ?? s.starts_at) : new Date(s.starts_at);
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

  const handleUpdate = async () => {
    if (!roomId) return;
    try {
      await updateOneToOneRoom.mutateAsync({ id: roomId, name: editName.trim() || null });
      toast({ title: "Room updated" });
      setEditOpen(false);
    } catch (e) {
      toast({
        title: "Failed to update",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!roomId) return;
    try {
      await deleteOneToOneRoom.mutateAsync(roomId);
      toast({ title: "1v1 room removed" });
      router.push("/dashboard/owner/rooms");
    } catch (e) {
      toast({
        title: "Failed to remove",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  if (!room && !isLoading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-16">
          <User className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">1v1 Room Not Found</h2>
          <p className="text-muted-foreground mb-6">
            This room doesn&apos;t exist or you don&apos;t have access to it.
          </p>
          <Button onClick={() => router.push("/dashboard/owner/rooms")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to 1v1 Rooms
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  if (!room) {
    return null;
  }

  const roomTitle = room.name || "1v1 room";
  const tutorName = room.tutorProfile?.display_name ?? room.tutorProfile?.email ?? "—";
  const studentName = room.studentProfile?.display_name ?? room.studentProfile?.email ?? "—";

  return (
    <>
      <OneToOneRoomDetailContent
        room={room}
        showContact
        backHref="/dashboard/owner/rooms"
        title={roomTitle}
        subtitle={`${tutorName} · ${studentName}`}
        headerActions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/dashboard/owner/student-records/${room.student_id}?roomId=${roomId}`)}
              className="gap-2"
            >
              <FileText className="w-4 h-4" />
              Student report
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditName(room.name ?? "");
                setEditOpen(true);
              }}
              className="gap-2"
            >
              <Pencil className="w-4 h-4" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive gap-2"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="w-4 h-4" />
              Remove room
            </Button>
          </>
        }
        assignments={roomAssignments}
        assignmentsLoading={assignmentsLoading}
        quizzes={roomQuizzes}
        quizzesLoading={quizzesLoading}
        viewRecordHref={`/dashboard/owner/student-records/${room.student_id}?roomId=${roomId}`}
        variant="owner"
        activityTimeline={activityTimeline}
        sessionsAnalytics={sessionsAnalytics}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit room name</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label>Name</Label>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Room name"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove 1v1 room?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the 1v1 room. The tutor and student accounts are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
