import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useClassrooms, useLeaveClassroom } from "@/hooks/useClassrooms";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
  BookOpen,
  Users,
  FileText,
  ClipboardCheck,
  MoreVertical,
  LogOut,
} from "lucide-react";

const StudentClassrooms = () => {
  const { classrooms, isLoading } = useClassrooms();
  const { user } = useAuth();
  const { toast } = useToast();
  const leaveClassroom = useLeaveClassroom();
  const router = useRouter();
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [classroomToLeave, setClassroomToLeave] = useState<{ id: string; name: string } | null>(null);
  const [classroomStats, setClassroomStats] = useState<Record<string, { materials: number; due: number }>>({});

  // Fetch stats for all classrooms
  useEffect(() => {
    if (!user || !classrooms || classrooms.length === 0) return;

    let cancelled = false;

    const fetchStats = async () => {
      try {
        const now = new Date();
        const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const statsEntries = await Promise.all(
          classrooms.map(async (classroom) => {
            try {
              const { data: shares, error: sharesError } = await supabase
                .from("document_classroom_shares")
                .select("document_id")
                .eq("classroom_id", classroom.id);

              if (sharesError) throw sharesError;

              const documentIds = shares?.map((s) => s.document_id) || [];
              const materialsPromise =
                documentIds.length > 0
                  ? supabase
                      .from("documents")
                      .select("*", { count: "exact", head: true })
                      .in("id", documentIds)
                  : Promise.resolve({ count: 0, error: null });

              const assignmentsPromise = supabase
                .from("assignments")
                .select("due_date")
                .eq("classroom_id", classroom.id)
                .eq("status", "published");

              const [{ count: materialsCount, error: materialsError }, { data: assignments, error: assignmentsError }] =
                await Promise.all([materialsPromise, assignmentsPromise]);

              if (materialsError) throw materialsError;
              if (assignmentsError) throw assignmentsError;

              const dueCount =
                assignments?.filter((a) => {
                  if (!a.due_date) return false;
                  const dueDate = new Date(a.due_date);
                  return dueDate >= now && dueDate <= sevenDaysFromNow;
                }).length || 0;

              return [
                classroom.id,
                {
                  materials: materialsCount || 0,
                  due: dueCount,
                },
              ] as const;
            } catch (error) {
              console.error("Failed to load classroom stats:", error);
              return [
                classroom.id,
                {
                  materials: 0,
                  due: 0,
                },
              ] as const;
            }
          })
        );

        if (!cancelled) {
          setClassroomStats(Object.fromEntries(statsEntries));
        }
      } catch (error) {
        console.error("Failed to load classroom stats:", error);
      }
    };

    fetchStats();

    return () => {
      cancelled = true;
    };
  }, [user, classrooms]);

  const handleLeaveClassroom = (classroomId: string, classroomName: string) => {
    setClassroomToLeave({ id: classroomId, name: classroomName });
    setLeaveDialogOpen(true);
  };

  const confirmLeaveClassroom = async () => {
    if (!classroomToLeave) return;
    
    try {
      await leaveClassroom.mutateAsync(classroomToLeave.id);
      setLeaveDialogOpen(false);
      setClassroomToLeave(null);
    } catch (error: unknown) {
      console.error("Failed to leave classroom:", error);
      toast({
        title: "Failed to leave classroom",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLeaveDialogOpen(false);
    }
  };

  const getStatusBadge = (status?: string | null, isArchived?: boolean) => {
    const normalized = status?.toLowerCase() ?? (isArchived ? "archived" : "active");

    switch (normalized) {
      case "active":
        return { label: "Active", variant: "secondary" as const };
      case "archived":
        return { label: "Archived", variant: "outline" as const };
      case "inactive":
        return { label: "Inactive", variant: "destructive" as const };
      default:
        return { label: "Unknown", variant: "outline" as const };
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">My Classes</h1>
          <p className="text-muted-foreground mt-1">
            View your enrolled classrooms and access materials
          </p>
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
                No classes yet
              </h3>
              <p className="text-muted-foreground text-center mb-6 max-w-sm">
                You&apos;re not in any class yet. Your tutor or school will add you to a class.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Classrooms Grid */}
        {!isLoading && classrooms && classrooms.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {classrooms.map((classroom) => {
              const statusBadge = getStatusBadge(undefined, classroom.is_archived ?? false);
              return (
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
                      <Badge variant={statusBadge.variant} className="text-xs">
                        {statusBadge.label}
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
                        <p className="text-lg font-semibold">{classroomStats[classroom.id]?.materials ?? 0}</p>
                        <p className="text-xs text-muted-foreground">Materials</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-lg">
                      <ClipboardCheck className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-lg font-semibold">{classroomStats[classroom.id]?.due ?? 0}</p>
                        <p className="text-xs text-muted-foreground">Due</p>
                      </div>
                    </div>
                  </div>

                  {/* View Button */}
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => router.push(`/dashboard/student/classrooms/${classroom.id}`)}
                  >
                    <BookOpen className="w-4 h-4" />
                    View Class
                  </Button>
                </CardContent>
              </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Leave Classroom Confirmation Dialog */}
      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Classroom</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave <span className="font-semibold">{classroomToLeave?.name}</span>? 
              You will lose access to all classroom materials and assignments. 
              Your tutor or school can add you again if needed.
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
