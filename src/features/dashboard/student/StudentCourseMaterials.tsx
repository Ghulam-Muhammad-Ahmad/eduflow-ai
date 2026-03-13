import { useState, useCallback, useEffect } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useClassrooms } from "@/hooks/useClassrooms";
import { useOneToOneRooms } from "@/hooks/useOneToOneRooms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Search,
  Filter,
  Grid3X3,
  List,
  FileText,
  FileImage,
  FileSpreadsheet,
  File,
  Download,
  BookOpen,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DocumentType {
  id: string;
  name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  created_at: string;
  classroom?: {
    id: string;
    name: string;
    subject: string | null;
  };
  oneToOneRoom?: {
    id: string;
    name: string | null;
  };
}

const getFileIcon = (fileType: string) => {
  if (fileType.includes("pdf")) return { icon: FileText, color: "text-rose-500 bg-rose-50" };
  if (fileType.includes("image")) return { icon: FileImage, color: "text-purple-500 bg-purple-50" };
  if (fileType.includes("spreadsheet") || fileType.includes("excel") || fileType.includes("xlsx"))
    return { icon: FileSpreadsheet, color: "text-green-500 bg-green-50" };
  if (fileType.includes("document") || fileType.includes("docx") || fileType.includes("word"))
    return { icon: FileText, color: "text-blue-500 bg-blue-50" };
  return { icon: File, color: "text-muted-foreground bg-secondary" };
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const StudentCourseMaterials = () => {
  const { user } = useAuth();
  const { classrooms } = useClassrooms();
  const { oneToOneRooms = [] } = useOneToOneRooms();
  const [documents, setDocuments] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedTarget, setSelectedTarget] = useState<string>("all"); // "all" | "classroom:id" | "room:id"
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("all");

  const handleToggleFilter = () => {
    setIsFilterOpen(!isFilterOpen);
  };

  const fetchSharedDocuments = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const classroomIds = classrooms?.map((c) => c.id) ?? [];
      const { data: roomRows } = await supabase
        .from("one_to_one_rooms")
        .select("id, name")
        .eq("student_id", user.id);
      const oneToOneRoomIds = roomRows?.map((r) => r.id) ?? [];

      const allDocIds = new Set<string>();
      const docToClassroom: Record<string, { id: string; name: string; subject: string | null }> = {};
      const docToRoom: Record<string, { id: string; name: string | null }> = {};

      if (classroomIds.length > 0) {
        const { data: shares, error: sharesError } = await supabase
          .from("document_classroom_shares")
          .select("document_id, classroom_id, classrooms(id, name, subject)")
          .in("classroom_id", classroomIds);
        if (!sharesError && shares) {
          shares.forEach((s) => {
            allDocIds.add(s.document_id);
            if (s.classrooms && !docToClassroom[s.document_id])
              docToClassroom[s.document_id] = {
                id: (s.classrooms as { id: string }).id,
                name: (s.classrooms as { name: string }).name,
                subject: (s.classrooms as { subject?: string | null }).subject ?? null,
              };
          });
        }
      }

      if (oneToOneRoomIds.length > 0) {
        const { data: roomShares, error: roomError } = await supabase
          .from("document_one_to_one_room_shares")
          .select("document_id, one_to_one_rooms(id, name)")
          .in("one_to_one_room_id", oneToOneRoomIds);
        if (!roomError && roomShares) {
          roomShares.forEach((s) => {
            allDocIds.add(s.document_id);
            const room = s.one_to_one_rooms as { id: string; name: string | null } | null;
            if (room && !docToRoom[s.document_id])
              docToRoom[s.document_id] = { id: room.id, name: room.name };
          });
        }
      }

      if (allDocIds.size === 0) {
        setDocuments([]);
        setLoading(false);
        return;
      }

      const { data: docs, error: docsError } = await supabase
        .from("documents")
        .select("*")
        .in("id", [...allDocIds])
        .order("created_at", { ascending: false });

      if (docsError) throw docsError;

      const documentsWithContext = (docs ?? []).map((doc) => ({
        ...doc,
        classroom: docToClassroom[doc.id],
        oneToOneRoom: docToRoom[doc.id],
      }));

      setDocuments(documentsWithContext);
    } catch (error) {
      console.error("Error fetching documents:", error);
      toast.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [user, classrooms]);

  useEffect(() => {
    fetchSharedDocuments();
  }, [fetchSharedDocuments]);

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

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTarget =
      selectedTarget === "all" ||
      (selectedTarget.startsWith("classroom:") && doc.classroom?.id === selectedTarget.replace("classroom:", "")) ||
      (selectedTarget.startsWith("room:") && doc.oneToOneRoom?.id === selectedTarget.replace("room:", ""));
    const matchesType =
      selectedType === "all" ||
      (selectedType === "pdf" && doc.file_type.includes("pdf")) ||
      (selectedType === "image" && doc.file_type.includes("image")) ||
      (selectedType === "spreadsheet" && (doc.file_type.includes("spreadsheet") || doc.file_type.includes("excel") || doc.file_type.includes("xlsx"))) ||
      (selectedType === "document" && (doc.file_type.includes("document") || doc.file_type.includes("docx") || doc.file_type.includes("word")));
    
    return matchesSearch && matchesTarget && matchesType;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Course Materials</h1>
            <p className="text-muted-foreground mt-1">
              Access documents and resources shared by your teachers
            </p>
          </div>
        </div>

        {/* Search and View Toggle */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button
            variant={isFilterOpen ? "secondary" : "outline"}
            size="sm"
            className="gap-2"
            onClick={handleToggleFilter}
          >
            <Filter className="w-4 h-4" />
            Filter
          </Button>
          <div className="flex border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="rounded-none h-9 w-9"
              onClick={() => setViewMode("grid")}
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="rounded-none h-9 w-9"
              onClick={() => setViewMode("list")}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Filters Panel */}
        {isFilterOpen && (
          <Card className="bg-muted/30 border-dashed">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    File Type
                  </label>
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger className="w-40 bg-background">
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="pdf">PDF Documents</SelectItem>
                      <SelectItem value="image">Images</SelectItem>
                      <SelectItem value="spreadsheet">Spreadsheets</SelectItem>
                      <SelectItem value="document">Word Documents</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Classroom / 1v1 Room
                  </label>
                  <Select value={selectedTarget} onValueChange={setSelectedTarget}>
                    <SelectTrigger className="w-48 bg-background">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {classrooms?.map((c) => (
                        <SelectItem key={c.id} value={`classroom:${c.id}`}>
                          {c.name}
                        </SelectItem>
                      ))}
                      {oneToOneRooms?.map((r) => (
                        <SelectItem key={r.id} value={`room:${r.id}`}>
                          {r.name || `${r.tutorProfile?.display_name ?? "1v1"} (1v1)`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setSelectedTarget("all");
                      setSelectedType("all");
                      setSearchQuery("");
                    }}
                  >
                    Clear All
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        )}

        {/* Empty State */}
        {!loading && (!classrooms || classrooms.length === 0) && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="feature-icon-indigo mb-4">
                <BookOpen className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No classes yet</h3>
              <p className="text-muted-foreground text-center mb-6 max-w-sm">
                Join a classroom to access shared course materials
              </p>
            </CardContent>
          </Card>
        )}

        {!loading && classrooms && classrooms.length > 0 && filteredDocuments.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FileText className="w-12 h-12 text-muted-foreground mb-3 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No documents found</h3>
              <p className="text-muted-foreground text-center">
                {searchQuery
                  ? "Try adjusting your search"
                  : "Your teachers haven't shared any documents yet"}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Documents Grid View */}
        {!loading && filteredDocuments.length > 0 && viewMode === "grid" && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredDocuments.map((doc) => {
              const { icon: FileIcon, color } = getFileIcon(doc.file_type);
              return (
                <Card
                  key={doc.id}
                  className="group hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => downloadDocument(doc)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start mb-2">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
                        <FileIcon className="w-6 h-6" />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadDocument(doc);
                        }}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                    <CardTitle className="text-sm line-clamp-2" title={doc.name}>
                      {doc.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(doc.file_size)} • {formatDate(doc.created_at)}
                      </p>
                      {(doc.classroom || doc.oneToOneRoom) && (
                        <Badge variant="secondary" className="text-xs">
                          {doc.classroom ? doc.classroom.name : (doc.oneToOneRoom?.name || "1v1 Room")}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Documents List View */}
        {!loading && filteredDocuments.length > 0 && viewMode === "list" && (
          <div className="space-y-2">
            {filteredDocuments.map((doc) => {
              const { icon: FileIcon, color } = getFileIcon(doc.file_type);
              return (
                <Card
                  key={doc.id}
                  className="group hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => downloadDocument(doc)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
                        <FileIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">{doc.name}</h4>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(doc.file_size)} • {formatDate(doc.created_at)}
                        </p>
                      </div>
                      {(doc.classroom || doc.oneToOneRoom) && (
                        <Badge variant="secondary">
                          {doc.classroom ? doc.classroom.name : (doc.oneToOneRoom?.name || "1v1 Room")}
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadDocument(doc);
                        }}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default StudentCourseMaterials;
