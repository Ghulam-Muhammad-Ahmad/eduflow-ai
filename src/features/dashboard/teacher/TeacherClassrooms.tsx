import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useClassrooms, useClassroomRoster } from "@/hooks/useClassrooms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Users,
  BookOpen,
  MoreVertical,
  Archive,
  Settings,
  Share2,
  UserMinus,
  Percent,
  ArrowRight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

interface ClassroomSettings {
  allowLateSubmissions: boolean;
  latePenaltyPercent: number;
  defaultPointsPossible: number;
  gradingScale: string;
}

const defaultSettings: ClassroomSettings = {
  allowLateSubmissions: true,
  latePenaltyPercent: 10,
  defaultPointsPossible: 100,
  gradingScale: "percentage",
};

const TeacherClassrooms = () => {
  const router = useRouter();
  const { classrooms, isLoading, archiveClassroom, removeStudent, updateClassroomSettings } = useClassrooms();
  const { toast } = useToast();
  const [rosterDialogOpen, setRosterDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [removeStudentDialogOpen, setRemoveStudentDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [selectedClassroomId, setSelectedClassroomId] = useState<string | null>(null);
  const [studentToRemove, setStudentToRemove] = useState<{ enrollmentId: string; name: string } | null>(null);
  const [classroomToArchive, setClassroomToArchive] = useState<{ id: string; name: string } | null>(null);

  // Settings form state
  const [settings, setSettings] = useState<ClassroomSettings>(defaultSettings);

  const { data: roster, isLoading: rosterLoading } = useClassroomRoster(selectedClassroomId);

  const selectedClassroom = classrooms?.find((c) => c.id === selectedClassroomId);

  // Load settings when opening settings dialog
  useEffect(() => {
    if (settingsDialogOpen && selectedClassroom) {
      const existingSettings = selectedClassroom.settings as ClassroomSettings | null;
      setSettings(existingSettings ? { ...defaultSettings, ...existingSettings } : defaultSettings);
    }
  }, [settingsDialogOpen, selectedClassroom]);

  const openRoster = (classroomId: string) => {
    setSelectedClassroomId(classroomId);
    setRosterDialogOpen(true);
  };

  const openSettings = (classroomId: string) => {
    setSelectedClassroomId(classroomId);
    setSettingsDialogOpen(true);
  };

  const handleRemoveStudent = (enrollmentId: string, studentName: string) => {
    setStudentToRemove({ enrollmentId, name: studentName });
    setRemoveStudentDialogOpen(true);
  };

  const confirmRemoveStudent = async () => {
    if (!studentToRemove || !selectedClassroomId) return;
    
    await removeStudent.mutateAsync({
      enrollmentId: studentToRemove.enrollmentId,
      classroomId: selectedClassroomId,
    });
    
    setRemoveStudentDialogOpen(false);
    setStudentToRemove(null);
  };

  const handleSaveSettings = async () => {
    if (!selectedClassroomId) return;
    
    await updateClassroomSettings.mutateAsync({
      id: selectedClassroomId,
      settings,
    });
    
    setSettingsDialogOpen(false);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">My Classrooms</h1>
          <p className="text-muted-foreground mt-1">
            Classes are created by your workspace owner. You&apos;ll see them here when assigned.
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
                <BookOpen className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No classrooms yet</h3>
              <p className="text-muted-foreground text-center mb-6 max-w-sm">
                Classes are created by your workspace owner. You&apos;ll see them here when you&apos;re assigned.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Classrooms Grid */}
        {!isLoading && classrooms && classrooms.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {classrooms.map((classroom) => (
              <Card
                key={classroom.id}
                className="group hover:shadow-lg transition-shadow"
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openSettings(classroom.id)}>
                          <Settings className="w-4 h-4 mr-2" />
                          Settings
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openRoster(classroom.id)}>
                          <Users className="w-4 h-4 mr-2" />
                          View Roster
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Share2 className="w-4 h-4 mr-2" />
                          Share Documents
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => {
                            setClassroomToArchive({ id: classroom.id, name: classroom.name });
                            setArchiveDialogOpen(true);
                          }}
                        >
                          <Archive className="w-4 h-4 mr-2" />
                          Archive
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {classroom.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {classroom.description}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 gap-2"
                      onClick={() => router.push(`/dashboard/teacher/classrooms/${classroom.id}`)}
                    >
                      <BookOpen className="w-4 h-4" />
                      Open Classroom
                      <ArrowRight className="w-4 h-4 ml-auto" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Roster Dialog */}
        <Dialog open={rosterDialogOpen} onOpenChange={setRosterDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {selectedClassroom?.name} - Roster
              </DialogTitle>
              <DialogDescription>
                Students enrolled in this classroom ({roster?.length || 0} students)
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {rosterLoading && (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 animate-pulse">
                      <div className="w-10 h-10 bg-secondary rounded-full" />
                      <div className="h-4 bg-secondary rounded w-32" />
                    </div>
                  ))}
                </div>
              )}

              {!rosterLoading && (!roster || roster.length === 0) && (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">
                    No students enrolled yet
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Students are added to your classes by your workspace owner
                  </p>
                </div>
              )}

              {!rosterLoading && roster && roster.length > 0 && (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {roster.map((enrollment) => {
                    const studentName = (enrollment.profiles as { display_name?: string; avatar_url?: string } | null)?.display_name || "Student";
                    return (
                      <div
                        key={enrollment.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 group"
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={(enrollment.profiles as { avatar_url?: string } | null)?.avatar_url} />
                          <AvatarFallback>
                            {(studentName[0] || "S").toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {studentName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Joined {new Date(enrollment.joined_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleRemoveStudent(enrollment.id, studentName)}
                        >
                          <UserMinus className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Archive classroom</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to archive{" "}
                <span className="font-semibold">{classroomToArchive?.name}</span>? Students will
                lose access until it is restored.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setClassroomToArchive(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (!classroomToArchive) return;
                  try {
                    await archiveClassroom.mutateAsync(classroomToArchive.id);
                  } catch (error: unknown) {
                    toast({
                      title: "Archive failed",
                      description: error instanceof Error ? error.message : "Unable to archive classroom.",
                      variant: "destructive",
                    });
                  } finally {
                    setArchiveDialogOpen(false);
                    setClassroomToArchive(null);
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={archiveClassroom.isPending}
              >
                {archiveClassroom.isPending ? "Archiving..." : "Archive"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Settings Dialog */}
        <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                <Settings className="w-5 h-5 inline-block mr-2" />
                Classroom Settings
              </DialogTitle>
              <DialogDescription>
                Configure grading and submission settings for {selectedClassroom?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {/* Late Submissions */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="allowLate" className="text-base">Allow Late Submissions</Label>
                    <p className="text-sm text-muted-foreground">
                      Students can submit after the due date
                    </p>
                  </div>
                  <Switch
                    id="allowLate"
                    checked={settings.allowLateSubmissions}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, allowLateSubmissions: checked })
                    }
                  />
                </div>

                {settings.allowLateSubmissions && (
                  <div className="space-y-2 pl-4 border-l-2 border-primary/20">
                    <Label htmlFor="latePenalty">Late Penalty (%)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="latePenalty"
                        type="number"
                        min="0"
                        max="100"
                        value={settings.latePenaltyPercent}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            latePenaltyPercent: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-24"
                      />
                      <Percent className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">deducted per day</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Default Points */}
              <div className="space-y-2">
                <Label htmlFor="defaultPoints">Default Points Possible</Label>
                <p className="text-sm text-muted-foreground">
                  Default point value for new assignments
                </p>
                <Input
                  id="defaultPoints"
                  type="number"
                  min="1"
                  value={settings.defaultPointsPossible}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      defaultPointsPossible: parseInt(e.target.value) || 100,
                    })
                  }
                  className="w-32"
                />
              </div>

              {/* Grading Scale */}
              <div className="space-y-2">
                <Label htmlFor="gradingScale">Grading Scale</Label>
                <p className="text-sm text-muted-foreground">
                  How grades are displayed to students
                </p>
                <Select
                  value={settings.gradingScale}
                  onValueChange={(value) =>
                    setSettings({ ...settings, gradingScale: value })
                  }
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (0-100%)</SelectItem>
                    <SelectItem value="points">Points Only</SelectItem>
                    <SelectItem value="letter">Letter Grade (A-F)</SelectItem>
                    <SelectItem value="passfail">Pass/Fail</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setSettingsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveSettings}
                disabled={updateClassroomSettings.isPending}
              >
                {updateClassroomSettings.isPending ? "Saving..." : "Save Settings"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Remove Student Confirmation Dialog */}
        <AlertDialog open={removeStudentDialogOpen} onOpenChange={setRemoveStudentDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Student</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove <span className="font-semibold">{studentToRemove?.name}</span> from this classroom? 
                They will lose access to all classroom materials and assignments. 
                Your workspace owner can add them again if needed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setStudentToRemove(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmRemoveStudent}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={removeStudent.isPending}
              >
                {removeStudent.isPending ? "Removing..." : "Remove Student"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default TeacherClassrooms;
