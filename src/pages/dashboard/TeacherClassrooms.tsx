import { useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useClassrooms, useClassroomRoster } from "@/hooks/useClassrooms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Users,
  Copy,
  Check,
  BookOpen,
  MoreVertical,
  Archive,
  Settings,
  Share2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

const TeacherClassrooms = () => {
  const { classrooms, isLoading, createClassroom, archiveClassroom } = useClassrooms();
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [rosterDialogOpen, setRosterDialogOpen] = useState(false);
  const [selectedClassroomId, setSelectedClassroomId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");

  const { data: roster, isLoading: rosterLoading } = useClassroomRoster(selectedClassroomId);

  const handleCreate = async () => {
    if (!name.trim()) return;

    await createClassroom.mutateAsync({
      name: name.trim(),
      subject: subject.trim() || null,
      description: description.trim() || null,
    });

    setName("");
    setSubject("");
    setDescription("");
    setCreateDialogOpen(false);
  };

  const copyJoinCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast({
      title: "Code copied!",
      description: "Share this code with your students.",
    });
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const openRoster = (classroomId: string) => {
    setSelectedClassroomId(classroomId);
    setRosterDialogOpen(true);
  };

  const selectedClassroom = classrooms?.find((c) => c.id === selectedClassroomId);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">My Classrooms</h1>
            <p className="text-muted-foreground mt-1">
              Create and manage your classrooms
            </p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Create Classroom
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Classroom</DialogTitle>
                <DialogDescription>
                  Set up a new classroom for your students. You'll get a unique
                  join code to share.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Classroom Name *</label>
                  <Input
                    placeholder="e.g., AP Calculus - Period 3"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Subject</label>
                  <Input
                    placeholder="e.g., Mathematics"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    placeholder="Brief description of the classroom..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!name.trim() || createClassroom.isPending}
                >
                  {createClassroom.isPending ? "Creating..." : "Create Classroom"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
                Create your first classroom to start sharing documents and
                assignments with students.
              </p>
              <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Create Your First Classroom
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
                        <DropdownMenuItem>
                          <Settings className="w-4 h-4 mr-2" />
                          Settings
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Share2 className="w-4 h-4 mr-2" />
                          Share Documents
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => archiveClassroom.mutate(classroom.id)}
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

                  {/* Join Code */}
                  <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">
                      Join Code:
                    </span>
                    <Badge
                      variant="secondary"
                      className="font-mono text-base tracking-widest"
                    >
                      {classroom.join_code}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-auto h-8 w-8"
                      onClick={() => copyJoinCode(classroom.join_code)}
                    >
                      {copiedCode === classroom.join_code ? (
                        <Check className="w-4 h-4 text-accent" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>

                  {/* Actions */}
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => openRoster(classroom.id)}
                  >
                    <Users className="w-4 h-4" />
                    View Roster
                  </Button>
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
                Students enrolled in this classroom
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
                    Share the join code with your students
                  </p>
                </div>
              )}

              {!rosterLoading && roster && roster.length > 0 && (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {roster.map((enrollment) => (
                    <div
                      key={enrollment.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={(enrollment.profiles as any)?.avatar_url} />
                        <AvatarFallback>
                          {((enrollment.profiles as any)?.display_name?.[0] || "S").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {(enrollment.profiles as any)?.display_name || "Student"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Joined {new Date(enrollment.joined_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default TeacherClassrooms;
