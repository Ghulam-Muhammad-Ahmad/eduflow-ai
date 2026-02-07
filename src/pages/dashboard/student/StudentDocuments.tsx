import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  Upload,
  Trash2,
  Folder,
  FolderPlus,
  Pencil,
  Eye,
  FolderInput,
} from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface DocumentType {
  id: string;
  name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  folder_id: string | null;
  created_at: string;
  user_id?: string;
}

interface FolderType {
  id: string;
  name: string;
  parent_id: string | null;
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
  const safeBytes = Math.max(0, bytes);
  if (safeBytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(safeBytes) / Math.log(k));
  const clampedIndex = Math.max(0, Math.min(i, sizes.length - 1));
  return (
    parseFloat((safeBytes / Math.pow(k, clampedIndex)).toFixed(1)) +
    " " +
    sizes[clampedIndex]
  );
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

/** Returns a display name that doesn't collide with existing names (adds (1), (2), ... before extension). */
function getUniqueDocumentName(originalName: string, existingNames: string[]): string {
  const lastDot = originalName.lastIndexOf(".");
  const base = lastDot >= 0 ? originalName.slice(0, lastDot) : originalName;
  const ext = lastDot >= 0 ? originalName.slice(lastDot) : "";
  let candidate = originalName;
  let n = 0;
  while (existingNames.includes(candidate)) {
    n += 1;
    candidate = `${base} (${n})${ext}`;
  }
  return candidate;
}

const StudentDocuments = () => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<DocumentType[]>([]);
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<DocumentType | null>(null);
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [documentToRename, setDocumentToRename] = useState<DocumentType | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [documentToPreview, setDocumentToPreview] = useState<DocumentType | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [documentToMove, setDocumentToMove] = useState<DocumentType | null>(null);
  const [moveTargetFolderId, setMoveTargetFolderId] = useState<string | null>(null);
  const [storageUsed, setStorageUsed] = useState(0);
  const storageLimit = 50 * 1024 * 1024; // 50 MB for students

  const fetchDocuments = useCallback(async () => {
    if (!user) return [];
    try {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      
      // Calculate storage used
      const totalSize = data?.reduce((acc, doc) => acc + (doc.file_size || 0), 0) || 0;
      setStorageUsed(totalSize);
      
      return data || [];
    } catch (error) {
      console.error("Error fetching documents:", error);
      toast.error("Failed to load your documents");
      return [];
    }
  }, [user]);

  const fetchFolders = useCallback(async () => {
    if (!user) return [];
    try {
      const { data, error } = await supabase
        .from("folders")
        .select("*")
        .eq("user_id", user.id)
        .order("name");
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching folders:", error);
      return [];
    }
  }, [user]);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    const [docsData, foldersData] = await Promise.all([
      fetchDocuments(),
      fetchFolders(),
    ]);
    setDocuments(docsData);
    setFolders(foldersData);
    setLoading(false);
  }, [fetchDocuments, fetchFolders]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!user) return;
      setUploading(true);

      try {
        // Enforce storage limit
        const { data: sizeData, error: sizeError } = await supabase
          .from("documents")
          .select("file_size")
          .eq("user_id", user.id);

        if (sizeError) throw sizeError;

        const currentUsedBytes = sizeData?.reduce((acc, doc) => acc + (doc.file_size || 0), 0) || 0;
        const incomingBytes = acceptedFiles.reduce((acc, f) => acc + f.size, 0);

        if (currentUsedBytes + incomingBytes > storageLimit) {
          toast.error(
            `Storage limit exceeded. Remaining: ${formatFileSize(
              Math.max(0, storageLimit - currentUsedBytes)
            )}. Attempted: ${formatFileSize(incomingBytes)}.`
          );
          return;
        }

        const folderQuery = supabase
          .from("documents")
          .select("name")
          .eq("user_id", user.id);
        const { data: existingDocs } = selectedFolder
          ? await folderQuery.eq("folder_id", selectedFolder)
          : await folderQuery.is("folder_id", null);
        const existingNamesList: string[] = (existingDocs ?? []).map((d) => d.name);

        for (const file of acceptedFiles) {
          const displayName = getUniqueDocumentName(file.name, existingNamesList);
          existingNamesList.push(displayName);

          const fileExt = file.name.includes(".") ? file.name.split(".").pop() : undefined;
          const fileType =
            file.type || (fileExt ? `application/${fileExt}` : "application/octet-stream");
          const fileName = `${user.id}/${Date.now()}_${file.name}`;

          const { error: uploadError } = await supabase.storage
            .from("documents")
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          const { error: insertError } = await supabase.from("documents").insert({
            user_id: user.id,
            folder_id: selectedFolder,
            name: displayName,
            file_path: fileName,
            file_size: file.size,
            file_type: fileType,
          });

          if (insertError) throw insertError;
        }

        toast.success(`${acceptedFiles.length} file(s) uploaded successfully`);
        fetchAllData();
      } catch (error) {
        console.error("Upload error:", error);
        toast.error("Failed to upload file(s)");
      } finally {
        setUploading(false);
      }
    },
    [user, selectedFolder, fetchAllData]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".svg"],
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-powerpoint": [".ppt"],
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
    },
    maxSize: 10 * 1024 * 1024,
  });

  const createFolder = async () => {
    if (!user || !newFolderName.trim()) return;

    try {
      const { error } = await supabase.from("folders").insert({
        user_id: user.id,
        name: newFolderName.trim(),
        parent_id: null,
      });

      if (error) throw error;

      toast.success("Folder created");
      setNewFolderDialogOpen(false);
      setNewFolderName("");
      fetchAllData();
    } catch (error) {
      console.error("Error creating folder:", error);
      toast.error("Failed to create folder");
    }
  };

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

  const handleDeleteConfirm = async () => {
    if (!documentToDelete) return;
    try {
      const { error: storageError } = await supabase.storage
        .from("documents")
        .remove([documentToDelete.file_path]);
      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from("documents")
        .delete()
        .eq("id", documentToDelete.id);
      if (dbError) throw dbError;

      toast.success("Document deleted");
      fetchAllData();
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error("Failed to delete document");
    } finally {
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
    }
  };

  const openRenameDialog = (doc: DocumentType) => {
    setDocumentToRename(doc);
    setRenameValue(doc.name);
    setRenameDialogOpen(true);
  };

  const handleRenameDocument = async () => {
    if (!documentToRename || !renameValue.trim()) return;
    try {
      const { error } = await supabase
        .from("documents")
        .update({ name: renameValue.trim() })
        .eq("id", documentToRename.id);
      if (error) throw error;
      toast.success("Document renamed");
      setRenameDialogOpen(false);
      setDocumentToRename(null);
      setRenameValue("");
      fetchAllData();
    } catch (error) {
      console.error("Error renaming document:", error);
      toast.error("Failed to rename document");
    }
  };

  const openPreview = useCallback(async (doc: DocumentType) => {
    setDocumentToPreview(doc);
    setPreviewUrl(null);
    setPreviewDialogOpen(true);
    setPreviewLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from("documents")
        .createSignedUrl(doc.file_path, 3600);
      if (error) throw error;
      setPreviewUrl(data?.signedUrl ?? null);
    } catch (e) {
      console.error("Preview error:", e);
      toast.error("Could not load preview");
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const closePreview = useCallback(() => {
    setPreviewDialogOpen(false);
    setDocumentToPreview(null);
    setPreviewUrl(null);
  }, []);

  const isPreviewableType = (fileType: string) => {
    const t = fileType.toLowerCase();
    return (
      t.includes("pdf") ||
      t.includes("image") ||
      t.includes("png") ||
      t.includes("jpg") ||
      t.includes("jpeg") ||
      t.includes("gif") ||
      t.includes("webp") ||
      t.includes("svg")
    );
  };

  const openMoveDialog = (doc: DocumentType) => {
    setDocumentToMove(doc);
    setMoveTargetFolderId(doc.folder_id);
    setMoveDialogOpen(true);
  };

  const handleMoveDocument = async () => {
    if (!documentToMove) return;
    try {
      const { error } = await supabase
        .from("documents")
        .update({ folder_id: moveTargetFolderId })
        .eq("id", documentToMove.id);
      if (error) throw error;
      toast.success("Document moved");
      setMoveDialogOpen(false);
      setDocumentToMove(null);
      setMoveTargetFolderId(null);
      fetchAllData();
    } catch (error) {
      console.error("Error moving document:", error);
      toast.error("Failed to move document");
    }
  };

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFolder = selectedFolder ? doc.folder_id === selectedFolder : true;
    return matchesSearch && matchesFolder;
  });

  const storagePercentage = (storageUsed / storageLimit) * 100;

  const renderDocuments = () => {
    if (filteredDocuments.length === 0) {
      return (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="w-12 h-12 text-muted-foreground mb-3 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No documents found</h3>
            <p className="text-muted-foreground text-center">
              {searchQuery
                ? "Try adjusting your search"
                : "Upload your first document"}
            </p>
          </CardContent>
        </Card>
      );
    }

    if (viewMode === "grid") {
      return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredDocuments.map((doc) => {
            const { icon: FileIcon, color } = getFileIcon(doc.file_type);
            return (
              <Card
                key={doc.id}
                className="group hover:shadow-lg transition-shadow"
              >
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
                      <FileIcon className="w-6 h-6" />
                    </div>
                    <div className="flex gap-1">
                      {isPreviewableType(doc.file_type) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            openPreview(doc);
                          }}
                          aria-label="Preview document"
                          title="Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          openMoveDialog(doc);
                        }}
                        aria-label="Move to folder"
                        title="Move to folder"
                      >
                        <FolderInput className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          openRenameDialog(doc);
                        }}
                        aria-label="Rename document"
                        title="Rename"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadDocument(doc);
                        }}
                        aria-label="Download document"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDocumentToDelete(doc);
                          setDeleteDialogOpen(true);
                        }}
                        aria-label="Delete document"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <CardTitle
                    className={`text-sm line-clamp-2 ${isPreviewableType(doc.file_type) ? "cursor-pointer hover:underline" : ""}`}
                    title={doc.name}
                    onClick={() => isPreviewableType(doc.file_type) && openPreview(doc)}
                  >
                    {doc.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(doc.file_size)} • {formatDate(doc.created_at)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {filteredDocuments.map((doc) => {
          const { icon: FileIcon, color } = getFileIcon(doc.file_type);
          return (
            <Card
              key={doc.id}
              className="group hover:shadow-md transition-shadow"
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
                    <FileIcon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4
                      className={`font-medium text-sm truncate ${isPreviewableType(doc.file_type) ? "cursor-pointer hover:underline" : ""}`}
                      onClick={() => isPreviewableType(doc.file_type) && openPreview(doc)}
                    >
                      {doc.name}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(doc.file_size)} • {formatDate(doc.created_at)}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {isPreviewableType(doc.file_type) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          openPreview(doc);
                        }}
                        aria-label="Preview document"
                        title="Preview"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        openMoveDialog(doc);
                      }}
                      aria-label="Move to folder"
                      title="Move to folder"
                    >
                      <FolderInput className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        openRenameDialog(doc);
                      }}
                      aria-label="Rename document"
                      title="Rename"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadDocument(doc);
                      }}
                      aria-label="Download document"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDocumentToDelete(doc);
                        setDeleteDialogOpen(true);
                      }}
                      aria-label="Delete document"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="flex gap-6 h-[calc(100vh-7rem)]">
        {/* Left Sidebar - Folders & Storage */}
        <div className="w-64 flex-shrink-0 flex flex-col">
          <div className="flex-1 overflow-auto">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  My Folders
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setNewFolderDialogOpen(true)}
                >
                  <FolderPlus className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-1">
                <button
                  onClick={() => setSelectedFolder(null)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    selectedFolder === null
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  <Folder className="w-4 h-4 text-primary" />
                  <span className="text-sm">All Documents</span>
                </button>

                {folders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => setSelectedFolder(folder.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      selectedFolder === folder.id
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    <Folder className="w-4 h-4 text-primary" />
                    <span className="text-sm">{folder.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Storage Usage */}
          <div className="pt-4 border-t border-border">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Storage</span>
              <span className="font-medium">{storagePercentage.toFixed(0)}%</span>
            </div>
            <Progress value={storagePercentage} className="h-2 mb-2" />
            <p className="text-xs text-muted-foreground">
              {formatFileSize(storageUsed)} of {formatFileSize(storageLimit)} used
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold">My Documents</h1>
              <p className="text-muted-foreground mt-1">
                Your personal documents and files
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents..."
                  className="pl-10 w-48"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
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
          </div>

          {/* Upload Area */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-8 mb-6 text-center transition-colors cursor-pointer ${
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium text-foreground mb-1">
              {uploading ? "Uploading..." : isDragActive ? "Drop files here" : "Upload documents"}
            </p>
            <p className="text-sm text-muted-foreground">
              Drag & drop files or click to browse (Max 10MB)
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, images
            </p>
            {selectedFolder && (
              <Badge variant="secondary" className="mt-3">
                Uploading to: {folders.find((f) => f.id === selectedFolder)?.name || "Selected Folder"}
              </Badge>
            )}
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          )}

          {/* Documents */}
          {!loading && renderDocuments()}
        </div>
      </div>

      {/* New Folder Dialog */}
      <Dialog open={newFolderDialogOpen} onOpenChange={setNewFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>
              Create a folder to organize your documents
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Input
                placeholder="Folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createFolder();
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createFolder} disabled={!newFolderName.trim()}>
              Create Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="truncate pr-8">{documentToPreview?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {previewLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
              </div>
            ) : previewUrl && documentToPreview ? (
              (() => {
                const t = documentToPreview.file_type.toLowerCase();
                const isPdf = t.includes("pdf");
                const isImage =
                  t.includes("image") ||
                  t.includes("png") ||
                  t.includes("jpg") ||
                  t.includes("jpeg") ||
                  t.includes("gif") ||
                  t.includes("webp") ||
                  t.includes("svg");
                if (isPdf) {
                  return (
                    <iframe
                      src={previewUrl}
                      title={documentToPreview.name}
                      className="w-full flex-1 min-h-[70vh] rounded border border-border bg-muted"
                    />
                  );
                }
                if (isImage) {
                  return (
                    <img
                      src={previewUrl}
                      alt={documentToPreview.name}
                      className="max-w-full max-h-[70vh] object-contain mx-auto rounded border border-border"
                    />
                  );
                }
                return null;
              })()
            ) : (
              <div className="py-16 text-center text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Preview not available for this file type.</p>
                {documentToPreview && (
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => downloadDocument(documentToPreview)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            {documentToPreview && (
              <Button variant="outline" onClick={() => downloadDocument(documentToPreview)}>
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            )}
            <Button variant="outline" onClick={closePreview}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move to Folder Dialog */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Move to folder</DialogTitle>
            <DialogDescription>
              Choose a folder for &quot;{documentToMove?.name}&quot;
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-80 overflow-y-auto">
            <button
              type="button"
              onClick={() => setMoveTargetFolderId(null)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                moveTargetFolderId === null
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-secondary"
              }`}
            >
              <Folder className="w-4 h-4 text-primary" />
              <span className="text-sm">Main (no folder)</span>
            </button>
            {folders.map((folder) => (
              <button
                key={folder.id}
                type="button"
                onClick={() => setMoveTargetFolderId(folder.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  moveTargetFolderId === folder.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:bg-secondary"
                }`}
              >
                <Folder className="w-4 h-4 text-primary" />
                <span className="text-sm">{folder.name}</span>
              </button>
            ))}
            {folders.length === 0 && (
              <p className="text-sm text-muted-foreground px-3">No folders yet. Create one from the sidebar.</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setMoveDialogOpen(false);
                setDocumentToMove(null);
                setMoveTargetFolderId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleMoveDocument}
              disabled={documentToMove?.folder_id === moveTargetFolderId}
            >
              Move here
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Document Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rename document</DialogTitle>
            <DialogDescription>
              Change the display name only. The file in storage is unchanged.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Document name"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRenameDocument()}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRenameDialogOpen(false);
                setDocumentToRename(null);
                setRenameValue("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleRenameDocument} disabled={!renameValue.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{documentToDelete?.name}&quot;? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default StudentDocuments;
