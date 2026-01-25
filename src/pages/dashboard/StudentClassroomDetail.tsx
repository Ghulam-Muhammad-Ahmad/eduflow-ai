import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useClassroomRoster, useClassrooms } from "@/hooks/useClassrooms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BookOpen, ClipboardList, FileText, Search, Users } from "lucide-react";

const StudentClassroomDetail = () => {
  const { classroomId } = useParams<{ classroomId: string }>();
  const navigate = useNavigate();
  const { classrooms } = useClassrooms();
  const { data: roster, isLoading: rosterLoading } = useClassroomRoster(classroomId || null);
  const [searchQuery, setSearchQuery] = useState("");

  const classroom = classrooms?.find((item) => item.id === classroomId);

  if (!classroom && !rosterLoading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-16">
          <BookOpen className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Classroom Not Found</h2>
          <p className="text-muted-foreground mb-6">
            This classroom doesn't exist or you don't have access to it.
          </p>
          <Button onClick={() => navigate("/dashboard/student/classrooms")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to My Classes
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const filteredRoster = roster?.filter((enrollment) => {
    const studentName = (enrollment.profiles as any)?.display_name || "Student";
    const studentEmail = (enrollment.profiles as any)?.email || "";
    const query = searchQuery.toLowerCase();
    return studentName.toLowerCase().includes(query) || studentEmail.toLowerCase().includes(query);
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard/student/classrooms")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl lg:text-3xl font-bold">{classroom?.name}</h1>
            {classroom?.subject && (
              <p className="text-muted-foreground mt-1">{classroom.subject}</p>
            )}
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="w-4 h-4" />
                Classmates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{roster?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ClipboardList className="w-4 h-4" />
                Assignments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">0</div>
              <p className="text-xs text-muted-foreground mt-1">Coming soon</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Materials
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">0</div>
              <p className="text-xs text-muted-foreground mt-1">Coming soon</p>
            </CardContent>
          </Card>
        </div>

        {/* Description */}
        {classroom?.description && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">About This Classroom</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{classroom.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Classmates */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Classmates</CardTitle>
                <CardDescription>
                  {filteredRoster?.length || 0} student{filteredRoster?.length !== 1 ? "s" : ""} enrolled
                </CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search classmates..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {rosterLoading && (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-4 rounded-lg border animate-pulse">
                    <div className="w-12 h-12 bg-secondary rounded-full" />
                    <div className="flex-1">
                      <div className="h-4 bg-secondary rounded w-32 mb-2" />
                      <div className="h-3 bg-secondary rounded w-24" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!rosterLoading && (!filteredRoster || filteredRoster.length === 0) && !searchQuery && (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No classmates yet</h3>
                <p className="text-muted-foreground">
                  Your teacher will invite more students to this class soon.
                </p>
              </div>
            )}

            {!rosterLoading && (!filteredRoster || filteredRoster.length === 0) && searchQuery && (
              <div className="text-center py-12">
                <Search className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No classmates found</h3>
                <p className="text-muted-foreground">
                  No classmates match your search query "{searchQuery}"
                </p>
              </div>
            )}

            {!rosterLoading && filteredRoster && filteredRoster.length > 0 && (
              <div className="space-y-2">
                {filteredRoster.map((enrollment) => {
                  const studentName = (enrollment.profiles as any)?.display_name || "Student";
                  const studentEmail = (enrollment.profiles as any)?.email || "Email unavailable";
                  const avatarUrl = (enrollment.profiles as any)?.avatar_url;

                  return (
                    <div
                      key={enrollment.id}
                      className="flex items-center gap-4 p-4 rounded-lg border hover:bg-secondary/30 transition-colors"
                    >
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={avatarUrl} />
                        <AvatarFallback className="text-lg">
                          {(studentName[0] || "S").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{studentName}</p>
                        <p className="text-sm text-muted-foreground truncate">{studentEmail}</p>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        Student
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default StudentClassroomDetail;
