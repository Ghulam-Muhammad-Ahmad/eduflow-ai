import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useOneToOneRooms } from "@/hooks/useOneToOneRooms";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { User, Users, ArrowLeft, Video } from "lucide-react";
import { format } from "date-fns";

export default function TeacherOneToOneRoomsList() {
  const { oneToOneRooms, isLoading } = useOneToOneRooms();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">1v1 Rooms</h1>
            <p className="text-muted-foreground mt-1">
              One-to-one rooms with your students. Use assignments, quizzes, and sessions in each room.
            </p>
          </div>
          <Button variant="ghost" asChild>
            <Link href="/dashboard/teacher/students">
              <ArrowLeft className="mr-2 h-4 w-4" />
              My Students
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : oneToOneRooms.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg">No 1v1 rooms yet</h3>
              <p className="text-sm text-muted-foreground mt-1 text-center max-w-sm">
                Your workspace owner can create 1v1 rooms and assign you to a student. You will see them here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-muted-foreground">Room</TableHead>
                    <TableHead className="text-muted-foreground">Student</TableHead>
                    <TableHead className="text-muted-foreground hidden sm:table-cell">Created</TableHead>
                    <TableHead className="text-right text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {oneToOneRooms.map((room) => (
                    <TableRow key={room.id} className="hover:bg-muted/20">
                      <TableCell>
                        <span className="font-medium">{room.name || "1v1 room"}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {room.studentProfile?.display_name ?? room.studentProfile?.email ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm hidden sm:table-cell">
                        {room.created_at ? format(new Date(room.created_at), "MMM d, yyyy") : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="outline" size="sm" asChild className="gap-1.5">
                            <Link href={`/dashboard/teacher/rooms/${room.id}`}>
                              <User className="h-4 w-4" />
                              View room
                            </Link>
                          </Button>
                          <Button variant="outline" size="sm" asChild className="gap-1.5">
                            <Link href={`/dashboard/teacher/sessions?studentId=${room.student_id}&scope=one_to_one`}>
                              <Video className="h-4 w-4" />
                              Sessions
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
