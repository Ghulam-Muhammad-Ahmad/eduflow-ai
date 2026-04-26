import { useMemo, useState } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Users, Search, Eye, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function OwnerOneToOneRoomsList() {
  const router = useRouter();
  const {
    workspace,
    oneToOneRooms,
    tutors,
    assignedStudents,
    createOneToOneRoom,
    isLoading,
  } = useOwnerWorkspace();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [tutorId, setTutorId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [roomName, setRoomName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const studentOptions = useMemo(() => {
    return (assignedStudents as { student_id: string; student?: { display_name?: string | null; email?: string | null } }[]).map(
      (row) => ({
        id: row.student_id,
        label: row.student?.display_name ?? row.student?.email ?? row.student_id,
      })
    );
  }, [assignedStudents]);

  const filteredRooms = useMemo(() => {
    if (!searchQuery.trim()) return oneToOneRooms;
    const q = searchQuery.toLowerCase().trim();
    return oneToOneRooms.filter((r) => {
      const tutorName = (r.tutorProfile?.display_name ?? r.tutorProfile?.email ?? "").toLowerCase();
      const studentName = (r.studentProfile?.display_name ?? r.studentProfile?.email ?? "").toLowerCase();
      const name = (r.name ?? "").toLowerCase();
      return tutorName.includes(q) || studentName.includes(q) || name.includes(q);
    });
  }, [oneToOneRooms, searchQuery]);

  const handleCreate = async () => {
    if (!tutorId || !studentId) {
      toast({
        title: "Tutor and student required",
        description: "Select both a tutor and a student.",
        variant: "destructive",
      });
      return;
    }
    try {
      await createOneToOneRoom.mutateAsync({
        tutorId,
        studentId,
        name: roomName.trim() || undefined,
      });
      toast({ title: "1v1 room created" });
      setTutorId("");
      setStudentId("");
      setRoomName("");
      setCreateOpen(false);
    } catch (e) {
      toast({
        title: "Failed to create 1v1 room",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">1v1 Rooms</h1>
            <p className="text-muted-foreground mt-1">
              {workspace?.name ?? "Workspace"} · One tutor and one student per room
            </p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Create 1v1 room
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create 1v1 room</DialogTitle>
                <DialogDescription>
                  Select an existing tutor and student from your workspace. Both must already be in the workspace.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Tutor *</Label>
                  <Select value={tutorId} onValueChange={setTutorId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select tutor" />
                    </SelectTrigger>
                    <SelectContent>
                      {tutors.map((t) => (
                        <SelectItem key={t.user_id} value={t.user_id}>
                          {t.profile?.display_name ?? t.profile?.email ?? t.user_id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Student *</Label>
                  <Select value={studentId} onValueChange={setStudentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select student" />
                    </SelectTrigger>
                    <SelectContent>
                      {studentOptions.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Room name (optional)</Label>
                  <Input
                    placeholder="e.g. Sarah – Math"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={!tutorId || !studentId}>
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {(tutors.length === 0 || studentOptions.length === 0) && (
          <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {tutors.length === 0 && studentOptions.length === 0
                ? "Add at least one tutor and one student to your workspace before creating 1v1 rooms."
                : tutors.length === 0
                ? "Add at least one tutor to your workspace before creating 1v1 rooms."
                : "Add at least one student to your workspace before creating 1v1 rooms."}
            </AlertDescription>
          </Alert>
        )}

        {filteredRooms.length === 0 && oneToOneRooms.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg">No 1v1 rooms yet</h3>
              <p className="text-sm text-muted-foreground mt-1 text-center max-w-sm">
                Create a 1v1 room by selecting a tutor and a student. Both must already be in your workspace.
              </p>
              <Button className="mt-4" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create 1v1 room
              </Button>
            </CardContent>
          </Card>
        ) : oneToOneRooms.length > 0 ? (
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden />
                <Input
                  type="search"
                  placeholder="Search by tutor, student, or room name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  aria-label="Search 1v1 rooms"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border/80 bg-muted/30">
                    <TableHead className="text-muted-foreground">Room</TableHead>
                    <TableHead className="text-muted-foreground">Tutor</TableHead>
                    <TableHead className="text-muted-foreground">Student</TableHead>
                    <TableHead className="text-muted-foreground hidden sm:table-cell">Created</TableHead>
                    <TableHead className="text-right text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRooms.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-sm text-muted-foreground">
                        No rooms match &quot;{searchQuery}&quot;. Try a different search.
                      </td>
                    </tr>
                  ) : (
                    filteredRooms.map((room) => (
                      <TableRow key={room.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell>
                          <span className="font-medium">{room.name || "1v1 room"}</span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {room.tutorProfile?.display_name ?? room.tutorProfile?.email ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {room.studentProfile?.display_name ?? room.studentProfile?.email ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm hidden sm:table-cell">
                          {room.created_at ? format(new Date(room.created_at), "MMM d, yyyy") : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="default"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => router.push(`/dashboard/owner/rooms/${room.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
