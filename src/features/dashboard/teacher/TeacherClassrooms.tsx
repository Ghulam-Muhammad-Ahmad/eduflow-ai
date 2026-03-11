import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useClassrooms, useClassroomRoster, useClassroomStudentCounts } from "@/hooks/useClassrooms";
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
  Archive,
  Settings,
  UserMinus,
  Percent,
  ArrowRight,
  Search,
} from "lucide-react";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [rosterDialogOpen, setRosterDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [removeStudentDialogOpen, setRemoveStudentDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [selectedClassroomId, setSelectedClassroomId] = useState<string | null>(null);
  const [studentToRemove, setStudentToRemove] = useState<{ enrollmentId: string; name: string } | null>(null);
  const [classroomToArchive, setClassroomToArchive] = useState<{ id: string; name: string } | null>(null);

  // Settings form state
  const [settings, setSettings] = useState<ClassroomSettings>(defaultSettings);

  const classroomIds = useMemo(() => classrooms?.map((c) => c.id) ?? [], [classrooms]);
  const { data: studentCounts = {} } = useClassroomStudentCounts(classroomIds);
  const { data: roster, isLoading: rosterLoading } = useClassroomRoster(selectedClassroomId);

  const selectedClassroom = classrooms?.find((c) => c.id === selectedClassroomId);

  const filteredClassrooms = useMemo(() => {
    if (!classrooms) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return classrooms;
    return classrooms.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.subject?.toLowerCase().includes(q) ||
        (c.description?.toLowerCase().includes(q))
    );
  }, [classrooms, searchQuery]);

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
    <DashboardLayout role="teacher">
      <div className="space-y-8 min-w-0 mx-auto">
        {/* Header */}
        <div className="text-center sm:text-left">
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
            My Classrooms
          </h1>
          <p className="text-muted-foreground mt-1.5">
            Classes are created by your workspace owner. You&apos;ll see them here when assigned.
          </p>
        </div>

        {/* Search */}
        {!isLoading && classrooms && classrooms.length > 0 && (
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Search by name, subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 rounded-lg border-border/80 bg-background"
              aria-label="Search classrooms"
            />
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-wrap justify-start gap-5">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="w-full sm:w-[300px] rounded-xl border-border/60 animate-pulse overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="h-6 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2 mt-2" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="h-12 bg-muted rounded" />
                  <div className="h-10 bg-muted rounded-lg" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && (!classrooms || classrooms.length === 0) && (
          <Card className="border-dashed border-2 border-muted-foreground/20 bg-muted/20 max-w-md mx-auto rounded-xl">
            <CardContent className="flex flex-col items-center justify-center py-16 px-8">
              <div className="rounded-full bg-primary/10 p-5 mb-4">
                <BookOpen className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No classrooms yet</h3>
              <p className="text-muted-foreground text-center max-w-sm">
                Classes are created by your workspace owner. You&apos;ll see them here when you&apos;re assigned.
              </p>
            </CardContent>
          </Card>
        )}

        {/* No search results */}
        {!isLoading && classrooms && classrooms.length > 0 && filteredClassrooms.length === 0 && (
          <Card className="border-dashed border-2 border-muted-foreground/20 bg-muted/10 max-w-md mx-auto rounded-xl">
            <CardContent className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <Search className="w-10 h-10 text-muted-foreground mb-3" />
              <h3 className="font-semibold text-foreground mb-1">No matches</h3>
              <p className="text-sm text-muted-foreground mb-4">
                No classrooms match &quot;{searchQuery.trim()}&quot;.
              </p>
              <Button variant="outline" size="sm" onClick={() => setSearchQuery("")}>
                Clear search
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Classrooms Grid */}
        {!isLoading && classrooms && classrooms.length > 0 && filteredClassrooms.length > 0 && (
          <div className="flex flex-wrap justify-start gap-5">
            {filteredClassrooms.map((classroom) => {
              const count = studentCounts[classroom.id] ?? 0;
              return (
                <Card
                  key={classroom.id}
                  className="group w-full sm:w-[300px] rounded-xl border-border/60 bg-card transition-all duration-200 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 overflow-hidden"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg font-semibold truncate text-foreground">
                          {classroom.name}
                        </CardTitle>
                        {classroom.subject && (
                          <CardDescription className="truncate text-muted-foreground mt-0.5">
                            {classroom.subject}
                          </CardDescription>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80"
                        onClick={(e) => {
                          e.stopPropagation();
                          openSettings(classroom.id);
                        }}
                        aria-label="Classroom settings"
                      >
                        <Settings className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {classroom.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {classroom.description}
                      </p>
                    )}

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <Users className="w-4 h-4" />
                        {count} {count === 1 ? "student" : "students"}
                      </span>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-primary font-medium"
                        onClick={(e) => {
                          e.stopPropagation();
                          openRoster(classroom.id);
                        }}
                      >
                        View roster
                      </Button>
                    </div>

                    <Button
                      className="w-full gap-2 font-medium rounded-lg"
                      onClick={() => router.push(`/dashboard/teacher/classrooms/${classroom.id}`)}
                    >
                      <BookOpen className="w-4 h-4" />
                      Open Classroom
                      <ArrowRight className="w-4 h-4 ml-auto" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
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
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <div className="w-full sm:mr-auto order-2 sm:order-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => {
                    if (selectedClassroom) {
                      setClassroomToArchive({ id: selectedClassroom.id, name: selectedClassroom.name });
                      setSettingsDialogOpen(false);
                      setArchiveDialogOpen(true);
                    }
                  }}
                >
                  <Archive className="w-4 h-4 mr-2" />
                  Archive classroom
                </Button>
              </div>
              <div className="flex gap-2 w-full sm:w-auto order-1 sm:order-2">
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
              </div>
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
