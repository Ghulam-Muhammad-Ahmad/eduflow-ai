import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Search,
  Filter,
  Grid3X3,
  List,
  Upload,
  Folder,
  FolderPlus,
  MoreVertical,
  FileText,
  FileImage,
  FileSpreadsheet,
  File,
  Trash2,
  Download,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
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
  updated_at: string;
  tags?: { id: string; name: string; color: string }[];
}

interface FolderType {
  id: string;
  name: string;
  parent_id: string | null;
}

interface TagType {
  id: string;
  name: string;
  color: string;
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

const TeacherDocuments = () => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<DocumentType[]>([]);
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [tags, setTags] = useState<TagType[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [storageUsed, setStorageUsed] = useState(0);
  const storageLimit = 20 * 1024 * 1024 * 1024; // 20 GB

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch folders
      const { data: foldersData } = await supabase
        .from("folders")
        .select("*")
        .eq("user_id", user.id)
        .order("name");

      // Fetch tags
      const { data: tagsData } = await supabase
        .from("tags")
        .select("*")
        .eq("user_id", user.id)
        .order("name");

      // Fetch documents with tags
      const { data: docsData } = await supabase
        .from("documents")
        .select(`
          *,
          document_tags(
            tag:tags(id, name, color)
          )
        `)
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (foldersData) setFolders(foldersData);
      if (tagsData) setTags(tagsData);
      if (docsData) {
        const docsWithTags = docsData.map((doc) => ({
          ...doc,
          tags: doc.document_tags?.map((dt: { tag: TagType }) => dt.tag).filter(Boolean) || [],
        }));
        setDocuments(docsWithTags);
        
        // Calculate storage used
        const totalSize = docsWithTags.reduce((acc, doc) => acc + (doc.file_size || 0), 0);
        setStorageUsed(totalSize);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!user) return;
      setUploading(true);

      try {
        for (const file of acceptedFiles) {
          const fileExt = file.name.split(".").pop();
          const fileName = `${user.id}/${Date.now()}_${file.name}`;

          // Upload to storage
          const { error: uploadError } = await supabase.storage
            .from("documents")
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          // Create document record
          const { error: insertError } = await supabase.from("documents").insert({
            user_id: user.id,
            folder_id: selectedFolder,
            name: file.name,
            file_path: fileName,
            file_size: file.size,
            file_type: file.type || `application/${fileExt}`,
          });

          if (insertError) throw insertError;
        }

        toast.success(`${acceptedFiles.length} file(s) uploaded successfully`);
        fetchData();
      } catch (error) {
        console.error("Upload error:", error);
        toast.error("Failed to upload file(s)");
      } finally {
        setUploading(false);
      }
    },
    [user, selectedFolder, fetchData]
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
    maxSize: 10 * 1024 * 1024, // 10MB
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
      fetchData();
    } catch (error) {
      console.error("Error creating folder:", error);
      toast.error("Failed to create folder");
    }
  };

  const deleteDocument = async (doc: DocumentType) => {
    if (!user) return;

    try {
      // Delete from storage
      await supabase.storage.from("documents").remove([doc.file_path]);

      // Delete from database
      const { error } = await supabase.from("documents").delete().eq("id", doc.id);
      if (error) throw error;

      toast.success("Document deleted");
      fetchData();
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error("Failed to delete document");
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
    } catch (error) {
      console.error("Error downloading:", error);
      toast.error("Failed to download document");
    }
  };

  // Filter documents
  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFolder = selectedFolder ? doc.folder_id === selectedFolder : true;
    const matchesTag = selectedTag
      ? doc.tags?.some((tag) => tag.id === selectedTag)
      : true;
    return matchesSearch && matchesFolder && matchesTag;
  });

  const defaultFolders = [
    { name: "Course Materials", icon: Folder },
    { name: "Student Assignments", icon: Folder },
    { name: "Lesson Plans", icon: Folder },
    { name: "Department Memos", icon: Folder },
    { name: "Research Papers", icon: Folder },
  ];

  const storagePercentage = (storageUsed / storageLimit) * 100;

  return (
    <DashboardLayout>
      <div className="flex gap-6 h-[calc(100vh-7rem)]">
        {/* Left Sidebar - Folders */}
        <div className="w-64 flex-shrink-0 flex flex-col">

          <div className="flex-1 overflow-auto">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  My Information
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

                {folders.length === 0 &&
                  defaultFolders.map((folder, idx) => (
                    <button
                      key={idx}
                      onClick={() => setNewFolderName(folder.name)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-muted-foreground hover:bg-secondary transition-colors"
                    >
                      <Folder className="w-4 h-4 text-primary" />
                      <span className="text-sm">{folder.name}</span>
                    </button>
                  ))}
              </div>
            </div>

            {tags.length > 0 && (
              <div className="mb-4">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
                  Tags
                </span>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant={selectedTag === tag.id ? "default" : "secondary"}
                      className="cursor-pointer"
                      onClick={() => setSelectedTag(selectedTag === tag.id ? null : tag.id)}
                    >
                      {tag.name}
                      {selectedTag === tag.id && (
                        <X className="w-3 h-3 ml-1" />
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
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
            <div className="flex items-center gap-2 text-sm">
              <button className="text-muted-foreground hover:text-foreground">🏠</button>
              <span className="text-muted-foreground">/</span>
              <span className="font-medium">My Documents</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Filter files..."
                  className="pl-10 w-48"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button variant="outline" size="sm" className="gap-2">
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
          </div>

          {/* Upload Drop Zone */}
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
            <p className="font-medium mb-1">
              {uploading
                ? "Uploading..."
                : isDragActive
                ? "Drop files here..."
                : "Click to upload or drag and drop"}
            </p>
            <p className="text-sm text-muted-foreground">
              SVG, PNG, JPG or PDF (max. 10MB)
            </p>
          </div>

          {/* Recent Files */}
          <div className="flex-1 overflow-auto">
            <h3 className="font-semibold mb-4">Recent Files</h3>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No documents found</p>
                <p className="text-sm">Upload your first document to get started</p>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredDocuments.map((doc) => {
                  const { icon: FileIcon, color } = getFileIcon(doc.file_type);
                  return (
                    <div
                      key={doc.id}
                      className="bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow group"
                    >
                      <div className="flex justify-between mb-4">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
                          <FileIcon className="w-6 h-6" />
                        </div>
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
                            <DropdownMenuItem onClick={() => downloadDocument(doc)}>
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => deleteDocument(doc)}
                              className="text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <h4 className="font-medium text-sm truncate mb-1" title={doc.name}>
                        {doc.name}
                      </h4>
                      <p className="text-xs text-muted-foreground mb-3">
                        {formatFileSize(doc.file_size)}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {formatDate(doc.created_at)}
                        </span>
                        {doc.tags && doc.tags.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {doc.tags[0].name}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredDocuments.map((doc) => {
                  const { icon: FileIcon, color } = getFileIcon(doc.file_type);
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center gap-4 p-4 bg-card border border-border rounded-lg hover:shadow-md transition-shadow group"
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
                        <FileIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">{doc.name}</h4>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(doc.file_size)} • {formatDate(doc.created_at)}
                        </p>
                      </div>
                      {doc.tags && doc.tags.length > 0 && (
                        <Badge variant="secondary">{doc.tags[0].name}</Badge>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => downloadDocument(doc)}>
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => deleteDocument(doc)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Folder Dialog */}
      <Dialog open={newFolderDialogOpen} onOpenChange={setNewFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Folder name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createFolder()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createFolder} disabled={!newFolderName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default TeacherDocuments;