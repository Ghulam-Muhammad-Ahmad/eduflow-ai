import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useClassrooms } from "@/hooks/useClassrooms";
import { useStudentAssignments } from "@/hooks/useAssignments";
import { useQuizzes } from "@/hooks/useQuizzes";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BookOpen, ClipboardList, FileText, Search, Download, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface DocumentType {
  id: string;
  name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  created_at: string;
}

const StudentClassroomDetail = () => {
  const router = useRouter();
  const classroomId = Array.isArray(router.query.classroomId)
    ? router.query.classroomId[0]
    : router.query.classroomId;
  const { classrooms, isLoading: classroomsLoading } = useClassrooms();
  const { user } = useAuth();
  const { data: assignments } = useStudentAssignments(classroomId);
  const { fetchClassroomQuizzes } = useQuizzes();
  const [documents, setDocuments] = useState<DocumentType[]>([]);
  const [quizzes, setQuizzes] = useState<{ id: string; title?: string; available_until?: string | null; status?: string }[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [quizzesLoading, setQuizzesLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const classroom = classrooms?.find((item) => item.id === classroomId);

  // Fetch documents
  useEffect(() => {
    if (!classroomId || !user) {
      setDocumentsLoading(false);
      return;
    }

    let cancelled = false;

    const fetchDocuments = async () => {
      setDocumentsLoading(true);

      try {
        // Fetch shared documents for this classroom
        const { data: shares, error: sharesError } = await supabase
          .from("document_classroom_shares")
          .select("document_id")
          .eq("classroom_id", classroomId);

        if (sharesError) throw sharesError;

        if (cancelled) return;

        if (!shares || shares.length === 0) {
          setDocuments([]);
          setDocumentsLoading(false);
          return;
        }

        const documentIds = [...new Set(shares.map((s) => s.document_id))];

        // Fetch document details
        const { data: docs, error: docsError } = await supabase
          .from("documents")
          .select("*")
          .in("id", documentIds)
          .order("created_at", { ascending: false });

        if (docsError) throw docsError;
        
        if (!cancelled) {
          setDocuments(docs || []);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Error fetching documents:", error);
          toast.error("Failed to load documents");
        }
      } finally {
        if (!cancelled) {
          setDocumentsLoading(false);
        }
      }
    };

    fetchDocuments();

    return () => {
      cancelled = true;
    };
  }, [classroomId, user]);

  // Fetch quizzes
  useEffect(() => {
    if (!classroomId) {
      setQuizzesLoading(false);
      return;
    }

    let cancelled = false;

    const fetchQuizzes = async () => {
      setQuizzesLoading(true);
      try {
        const data = await fetchClassroomQuizzes(classroomId);
        if (!cancelled) {
          // Filter for active/scheduled quizzes only
          const activeQuizzes = data.filter((q) => q.status === "active" || q.status === "scheduled");
          setQuizzes(activeQuizzes);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Error fetching quizzes:", error);
        }
      } finally {
        if (!cancelled) {
          setQuizzesLoading(false);
        }
      }
    };

    fetchQuizzes();

    return () => {
      cancelled = true;
    };
  }, [classroomId, fetchClassroomQuizzes]);

  const downloadDocument = async (doc: DocumentType) => {
    try {
      const { data, error } = await supabase.storage
        .from("documents")
        .download(doc.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.name;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Document downloaded");
    } catch (error) {
      console.error("Error downloading:", error);
      toast.error("Failed to download document");
    }
  };

  if (classroomId && !classroom && !classroomsLoading && !documentsLoading && !quizzesLoading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-16">
          <BookOpen className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Classroom Not Found</h2>
          <p className="text-muted-foreground mb-6">
            This classroom doesn&apos;t exist or you don&apos;t have access to it.
          </p>
          <Button onClick={() => router.push("/dashboard/student/classrooms")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to My Classes
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const filteredDocuments = documents.filter((doc) =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAssignments = assignments?.filter((a) =>
    a.title.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const filteredQuizzes = quizzes.filter((q) =>
    (q.title ?? "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashboard/student/classrooms")}
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
                <FileText className="w-4 h-4" />
                Materials
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{documents.length}</div>
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
              <div className="text-3xl font-bold">{assignments?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <HelpCircle className="w-4 h-4" />
                Quizzes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{quizzes.length}</div>
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

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search materials, assignments, or quizzes..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        {/* Materials Section */}
        <Card>
          <CardHeader>
            <CardTitle>Course Materials</CardTitle>
            <CardDescription>
              {filteredDocuments.length} document{filteredDocuments.length !== 1 ? "s" : ""} available
            </CardDescription>
          </CardHeader>
          <CardContent>
            {documentsLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-4 rounded-lg border animate-pulse">
                    <div className="w-12 h-12 bg-secondary rounded-lg" />
                    <div className="flex-1">
                      <div className="h-4 bg-secondary rounded w-32 mb-2" />
                      <div className="h-3 bg-secondary rounded w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No materials available</h3>
                <p className="text-muted-foreground">
                  {searchQuery ? "No materials match your search" : "Your teacher hasn't shared any materials yet"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-4 p-4 rounded-lg border hover:bg-secondary/30 transition-colors cursor-pointer"
                    onClick={() => downloadDocument(doc)}
                  >
                    <div className="w-12 h-12 bg-secondary rounded-lg flex items-center justify-center">
                      <FileText className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{doc.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(doc.created_at), "MMM d, yyyy")}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadDocument(doc);
                      }}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assignments Section */}
        <Card>
          <CardHeader>
            <CardTitle>Assignments</CardTitle>
            <CardDescription>
              {filteredAssignments.length} assignment{filteredAssignments.length !== 1 ? "s" : ""} available
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredAssignments.length === 0 ? (
              <div className="text-center py-12">
                <ClipboardList className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No assignments available</h3>
                <p className="text-muted-foreground">
                  {searchQuery ? "No assignments match your search" : "Your teacher hasn't published any assignments yet"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredAssignments.map((assignment: { id?: string; title?: string; due_date?: string | null; mySubmission?: unknown }) => (
                  <div
                    key={assignment.id}
                    className="flex items-center gap-4 p-4 rounded-lg border hover:bg-secondary/30 transition-colors cursor-pointer"
                    onClick={() => {
                      if (!assignment?.id) {
                        router.push(`/dashboard/student/assignments`);
                        return;
                      }
                      router.push(`/dashboard/student/assignments/${assignment.id}`);
                    }}
                  >
                    <div className="w-12 h-12 bg-secondary rounded-lg flex items-center justify-center">
                      <ClipboardList className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{assignment.title ?? "Assignment"}</p>
                      <p className="text-sm text-muted-foreground">
                        {assignment.due_date
                          ? `Due: ${format(new Date(assignment.due_date), "MMM d, yyyy")}`
                          : "No due date"}
                        {Boolean(assignment.mySubmission) && (
                          <Badge variant="secondary" className="ml-2">Submitted</Badge>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quizzes Section */}
        <Card>
          <CardHeader>
            <CardTitle>Quizzes</CardTitle>
            <CardDescription>
              {filteredQuizzes.length} quiz{filteredQuizzes.length !== 1 ? "zes" : ""} available
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredQuizzes.length === 0 ? (
              <div className="text-center py-12">
                <HelpCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No quizzes available</h3>
                <p className="text-muted-foreground">
                  {searchQuery ? "No quizzes match your search" : "Your teacher hasn't published any quizzes yet"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredQuizzes.map((quiz) => (
                  <div
                    key={quiz.id}
                    className="flex items-center gap-4 p-4 rounded-lg border hover:bg-secondary/30 transition-colors cursor-pointer"
                    onClick={() => {
                      if (!quiz?.id) {
                        router.push(`/dashboard/student/quizzes`);
                        return;
                      }
                      router.push(`/dashboard/student/quizzes/${quiz.id}`);
                    }}
                  >
                    <div className="w-12 h-12 bg-secondary rounded-lg flex items-center justify-center">
                      <HelpCircle className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{quiz.title ?? "Quiz"}</p>
                      <p className="text-sm text-muted-foreground">
                        {quiz.available_until
                          ? `Available until: ${format(new Date(quiz.available_until), "MMM d, yyyy")}`
                          : "No end date"}
                        <Badge variant="outline" className="ml-2">{`${quiz.status ?? "—"}`}</Badge>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default StudentClassroomDetail;
