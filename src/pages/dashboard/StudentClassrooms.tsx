import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useClassrooms, useLeaveClassroom } from "@/hooks/useClassrooms";
import JoinClassroomDialog from "@/components/student/JoinClassroomDialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  BookOpen,
  Users,
  FileText,
  ClipboardCheck,
  MoreVertical,
  LogOut,
} from "lucide-react";

const StudentClassrooms = () => {
  const { classrooms, isLoading } = useClassrooms();
  const leaveClassroom = useLeaveClassroom();
  const navigate = useNavigate();
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [classroomToLeave, setClassroomToLeave] = useState<{ id: string; name: string } | null>(null);

  const handleLeaveClassroom = (classroomId: string, classroomName: string) => {
    setClassroomToLeave({ id: classroomId, name: classroomName });
    setLeaveDialogOpen(true);
  };

  const confirmLeaveClassroom = async () => {
    if (!classroomToLeave) return;
    
    await leaveClassroom.mutateAsync(classroomToLeave.id);
    setLeaveDialogOpen(false);
    setClassroomToLeave(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">My Classes</h1>
            <p className="text-muted-foreground mt-1">
              View your enrolled classrooms and access materials
            </p>
          </div>
          <Button onClick={() => setJoinDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Join Class
          </Button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-secondary rounded w-3/4" />
                  <div className="h-4 bg-secondary rounded w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <div className="h-20 bg-secondary rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && (!classrooms || classrooms.length === 0) && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="feature-icon-indigo mb-4">
                <Users className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                No classes joined yet
              </h3>
              <p className="text-muted-foreground text-center mb-6 max-w-sm">
                Ask your teacher for a classroom code to join their class and
                access assignments and materials.
              </p>
              <Button onClick={() => setJoinDialogOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Join Your First Class
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Classrooms Grid */}
        {!isLoading && classrooms && classrooms.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {classrooms.map((classroom) => (
              <Card
                key={classroom.id}
                className="group hover:shadow-lg transition-all"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">
                        {classroom.name}
                      </CardTitle>
                      {classroom.subject && (
                        <CardDescription className="truncate">
                          {classroom.subject}
                        </CardDescription>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        Active
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleLeaveClassroom(classroom.id, classroom.name)}
                          >
                            <LogOut className="w-4 h-4 mr-2" />
                            Leave Class
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {classroom.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {classroom.description}
                    </p>
                  )}

                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-lg">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-lg font-semibold">--</p>
                        <p className="text-xs text-muted-foreground">Materials</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-lg">
                      <ClipboardCheck className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-lg font-semibold">--</p>
                        <p className="text-xs text-muted-foreground">Due</p>
                      </div>
                    </div>
                  </div>

                  {/* View Button */}
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => navigate(`/dashboard/student/classrooms/${classroom.id}`)}
                  >
                    <BookOpen className="w-4 h-4" />
                    View Class
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Join Dialog */}
      <JoinClassroomDialog
        open={joinDialogOpen}
        onOpenChange={setJoinDialogOpen}
      />

      {/* Leave Classroom Confirmation Dialog */}
      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Classroom</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave <span className="font-semibold">{classroomToLeave?.name}</span>? 
              You will lose access to all classroom materials and assignments. 
              You can rejoin later using the classroom code.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setClassroomToLeave(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmLeaveClassroom}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={leaveClassroom.isPending}
            >
              {leaveClassroom.isPending ? "Leaving..." : "Leave Classroom"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default StudentClassrooms;
