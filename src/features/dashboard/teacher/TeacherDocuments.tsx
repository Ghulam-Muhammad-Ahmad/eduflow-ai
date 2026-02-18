import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { useDropzone } from "react-dropzone";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useClassrooms } from "@/hooks/useClassrooms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Link from "next/link";
import {
  Search,
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
  Share2,
  Pencil,
  Eye,
  FolderInput,
  Tag,
  Plus,
  ChevronRight,
  Home,
  Scissors,
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { parsePageRange, validatePageNumbers } from "@/lib/pageRange";

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
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB"];
  const rawIndex = Math.floor(Math.log(bytes) / Math.log(k));
  const i = Math.min(Math.max(rawIndex, 0), sizes.length - 1);
  const value = bytes / Math.pow(k, i);
  if (!Number.isFinite(value)) return "0 Bytes";
  const unit = sizes[i] || sizes[sizes.length - 1];
  return `${parseFloat(value.toFixed(1))} ${unit}`;
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const TAG_COLORS = [
  "#64748b", "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899", "#a855f7",
] as const;

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

const TeacherDocuments = () => {
  const { user } = useAuth();
  const { classrooms } = useClassrooms();
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
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [documentToShare, setDocumentToShare] = useState<DocumentType | null>(null);
  const [selectedClassrooms, setSelectedClassrooms] = useState<string[]>([]);
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
  const storageLimit = 100 * 1024 * 1024; // 100 MB
  // Tags: edit tags on document
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const [documentToTag, setDocumentToTag] = useState<DocumentType | null>(null);
  const [selectedTagIdsForDoc, setSelectedTagIdsForDoc] = useState<string[]>([]);
  const [tagsSaving, setTagsSaving] = useState(false);
  // Create new tag (global or from dialog)
  const [newTagDialogOpen, setNewTagDialogOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState<string>(TAG_COLORS[0]);
  const [createTagLoading, setCreateTagLoading] = useState(false);
  // Split PDF dialog
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const [documentToSplit, setDocumentToSplit] = useState<DocumentType | null>(null);
  const [splitPageRange, setSplitPageRange] = useState("");
  const [splitNewFileName, setSplitNewFileName] = useState("");
  const [splitLoading, setSplitLoading] = useState(false);
  const [splitPreviewUrl, setSplitPreviewUrl] = useState<string | null>(null);
  const [splitPageCount, setSplitPageCount] = useState<number | null>(null);
  const [splitPageCountLoading, setSplitPageCountLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch folders
      const { data: foldersData, error: foldersError } = await supabase
        .from("folders")
        .select("*")
        .eq("user_id", user.id)
        .order("name");
      if (foldersError) throw foldersError;

      // Fetch tags
      const { data: tagsData, error: tagsError } = await supabase
        .from("tags")
        .select("*")
        .eq("user_id", user.id)
        .order("name");
      if (tagsError) throw tagsError;

      // Fetch documents with tags
      const { data: docsData, error: docsError } = await supabase
        .from("documents")
        .select(`
          *,
          document_tags(
            tag:tags(id, name, color)
          )
        `)
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      if (docsError) throw docsError;

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
        const incomingBytes = acceptedFiles.reduce((acc, f) => acc + f.size, 0);
        let usageQuery = supabase
          .from("documents")
          .select("file_size")
          .eq("user_id", user.id);
        if (selectedFolder) {
          usageQuery = usageQuery.eq("folder_id", selectedFolder);
        }
        const { data: sizeData, error: sizeError } = await usageQuery;
        if (sizeError) throw sizeError;

        const currentUsedBytes =
          sizeData?.reduce((acc, doc) => acc + (doc.file_size || 0), 0) || 0;

        if (currentUsedBytes + incomingBytes > storageLimit) {
          toast.error(
            `Storage limit exceeded. Remaining: ${formatFileSize(
              Math.max(0, storageLimit - currentUsedBytes)
            )}. Attempted: ${formatFileSize(incomingBytes)}.`
          );
          return;
        }

        // Existing document names in this folder (to avoid duplicates)
        const folderQuery = supabase
          .from("documents")
          .select("name")
          .eq("user_id", user.id);
        const { data: existingDocs } = selectedFolder
          ? await folderQuery.eq("folder_id", selectedFolder)
          : await folderQuery.is("folder_id", null);
        const existingNames = new Set((existingDocs ?? []).map((d) => d.name));
        const existingNamesList: string[] = Array.from(existingNames);

        for (const file of acceptedFiles) {
          const displayName = getUniqueDocumentName(file.name, existingNamesList);
          existingNamesList.push(displayName);

          const fileExt = file.name.split(".").pop();
          const fileName = `${user.id}/${Date.now()}_${file.name}`;

          // Upload to storage
          const { error: uploadError } = await supabase.storage
            .from("documents")
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          // Create document record (use displayName so duplicates get (1), (2), etc.)
          const { error: insertError } = await supabase.from("documents").insert({
            user_id: user.id,
            folder_id: selectedFolder,
            name: displayName,
            file_path: fileName,
            file_size: file.size,
            file_type: file.type || `application/${fileExt}`,
          });

          if (insertError) {
            const { error: removeError } = await supabase.storage
              .from("documents")
              .remove([fileName]);
            if (removeError) {
              console.error("Error removing orphaned upload:", removeError);
            }
            throw insertError;
          }
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
    [user, selectedFolder, fetchData, storageLimit]
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
    const shouldDelete = window.confirm(
      `Are you sure you want to delete "${doc.name}"? This action cannot be undone.`
    );
    if (!shouldDelete) return;

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("documents")
        .remove([doc.file_path]);
      if (storageError) {
        console.error("Error deleting file from storage:", storageError);
        toast.error("Failed to delete document file from storage");
        return;
      }

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

  const openShareDialog = async (doc: DocumentType) => {
    setDocumentToShare(doc);
    
    // Fetch existing shares for this document
    const { data: existingShares } = await supabase
      .from("document_classroom_shares")
      .select("classroom_id")
      .eq("document_id", doc.id);
    
    setSelectedClassrooms(existingShares?.map((s) => s.classroom_id) || []);
    setShareDialogOpen(true);
  };

  const handleShareDocument = async () => {
    if (!documentToShare) return;

    try {
      const { data: existingShares, error: existingError } = await supabase
        .from("document_classroom_shares")
        .select("classroom_id")
        .eq("document_id", documentToShare.id);
      if (existingError) throw existingError;

      const existingIds = existingShares?.map((s) => s.classroom_id) || [];
      const idsToRemove = existingIds.filter((id) => !selectedClassrooms.includes(id));
      const idsToAdd = selectedClassrooms.filter((id) => !existingIds.includes(id));
      let removedIds: string[] = [];

      if (idsToRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from("document_classroom_shares")
          .delete()
          .in("classroom_id", idsToRemove)
          .eq("document_id", documentToShare.id);
        if (deleteError) throw deleteError;
        removedIds = idsToRemove;
      }

      // Then add new shares
      if (idsToAdd.length > 0) {
        const shares = idsToAdd.map((classroomId) => ({
          document_id: documentToShare.id,
          classroom_id: classroomId,
        }));

        const { error } = await supabase
          .from("document_classroom_shares")
          .insert(shares);

        if (error) {
          if (removedIds.length > 0) {
            const { error: rollbackError } = await supabase
              .from("document_classroom_shares")
              .insert(
                removedIds.map((classroomId) => ({
                  document_id: documentToShare.id,
                  classroom_id: classroomId,
                }))
              );
            if (rollbackError) {
              console.error("Rollback failed after share insert error:", rollbackError);
            }
          }
          throw error;
        }
      }

      toast.success(
        selectedClassrooms.length > 0
          ? `Shared with ${selectedClassrooms.length} classroom(s)`
          : "Document unshared from all classrooms"
      );
      setShareDialogOpen(false);
      setDocumentToShare(null);
      setSelectedClassrooms([]);
    } catch (error) {
      console.error("Error sharing document:", error);
      toast.error("Failed to share document");
    }
  };

  const toggleClassroomSelection = (classroomId: string) => {
    setSelectedClassrooms((prev) =>
      prev.includes(classroomId)
        ? prev.filter((id) => id !== classroomId)
        : [...prev, classroomId]
    );
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
      fetchData();
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

  const isPdfDocument = (doc: DocumentType) => {
    const t = (doc.file_type || "").toLowerCase();
    const n = (doc.name || "").toLowerCase();
    return t.includes("pdf") || n.endsWith(".pdf");
  };

  const openSplitDialog = (doc: DocumentType) => {
    const base = doc.name.replace(/\.pdf$/i, "") || doc.name;
    setDocumentToSplit(doc);
    setSplitPageRange("1");
    setSplitNewFileName(`${base} - split.pdf`);
    setSplitPreviewUrl(null);
    setSplitPageCount(null);
    setSplitDialogOpen(true);
  };

  useEffect(() => {
    if (!splitDialogOpen || !documentToSplit) return;
    let cancelled = false;
    setSplitPageCountLoading(true);
    (async () => {
      try {
        const [urlRes, countRes] = await Promise.all([
          supabase.storage
            .from("documents")
            .createSignedUrl(documentToSplit.file_path, 3600),
          fetch("/api/documents/pdf-page-count", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ documentId: documentToSplit.id }),
          }),
        ]);
        if (cancelled) return;
        if (urlRes.data?.signedUrl) setSplitPreviewUrl(urlRes.data.signedUrl);
        if (countRes.ok) {
          const data = await countRes.json().catch(() => ({}));
          if (typeof data.numPages === "number") setSplitPageCount(data.numPages);
        }
      } catch {
        if (!cancelled) setSplitPageCount(null);
      } finally {
        if (!cancelled) setSplitPageCountLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [splitDialogOpen, documentToSplit?.id, documentToSplit?.file_path]);

  const handleSplitPdf = async () => {
    if (!documentToSplit || !splitPageRange.trim() || !splitNewFileName.trim()) return;
    if (!splitNewFileName.toLowerCase().endsWith(".pdf")) {
      toast.error("New file name must end with .pdf");
      return;
    }
    setSplitLoading(true);
    try {
      const res = await fetch("/api/documents/split-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: documentToSplit.id,
          pageRange: splitPageRange.trim(),
          newFileName: splitNewFileName.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Failed to split PDF");
        return;
      }
      toast.success("PDF created: " + (data.document?.name ?? splitNewFileName));
      setSplitDialogOpen(false);
      setDocumentToSplit(null);
      setSplitPageRange("");
      setSplitNewFileName("");
      fetchData();
    } catch (e) {
      console.error("Split PDF error:", e);
      toast.error("Failed to split PDF");
    } finally {
      setSplitLoading(false);
    }
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
      fetchData();
    } catch (error) {
      console.error("Error moving document:", error);
      toast.error("Failed to move document");
    }
  };

  const openTagsDialog = (doc: DocumentType) => {
    setDocumentToTag(doc);
    setSelectedTagIdsForDoc(doc.tags?.map((t) => t.id) ?? []);
    setTagsDialogOpen(true);
  };

  const toggleTagForDoc = (tagId: string) => {
    setSelectedTagIdsForDoc((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleSaveDocumentTags = async () => {
    if (!documentToTag || !user) return;
    setTagsSaving(true);
    try {
      const currentIds = documentToTag.tags?.map((t) => t.id) ?? [];
      const toAdd = selectedTagIdsForDoc.filter((id) => !currentIds.includes(id));
      const toRemove = currentIds.filter((id) => !selectedTagIdsForDoc.includes(id));

      if (toRemove.length > 0) {
        const { error: delError } = await supabase
          .from("document_tags")
          .delete()
          .eq("document_id", documentToTag.id)
          .in("tag_id", toRemove);
        if (delError) throw delError;
      }
      if (toAdd.length > 0) {
        const rows = toAdd.map((tag_id) => ({ document_id: documentToTag.id, tag_id }));
        const { error: insError } = await supabase.from("document_tags").insert(rows);
        if (insError) throw insError;
      }

      toast.success("Tags updated");
      setTagsDialogOpen(false);
      setDocumentToTag(null);
      fetchData();
    } catch (error) {
      console.error("Error updating tags:", error);
      toast.error("Failed to update tags");
    } finally {
      setTagsSaving(false);
    }
  };

  const createTag = async (name?: string, color?: string) => {
    const tagName = (name ?? newTagName).trim();
    const tagColor = color ?? newTagColor;
    if (!user || !tagName) return;
    setCreateTagLoading(true);
    try {
      const { data, error } = await supabase
        .from("tags")
        .insert({ user_id: user.id, name: tagName, color: tagColor })
        .select("id, name, color")
        .single();
      if (error) throw error;
      setTags((prev) => [...prev, { id: data.id, name: data.name, color: data.color }]);
      setNewTagDialogOpen(false);
      setNewTagName("");
      setNewTagColor(TAG_COLORS[0]);
      toast.success("Tag created");
      fetchData();
      return data.id;
    } catch (error) {
      console.error("Error creating tag:", error);
      toast.error("Failed to create tag");
      return null;
    } finally {
      setCreateTagLoading(false);
    }
  };

  const handleCreateTagAndAddToDoc = async () => {
    const tagName = newTagName.trim();
    if (!tagName) return;
    const newId = await createTag(tagName, newTagColor);
    if (newId && documentToTag) {
      setSelectedTagIdsForDoc((prev) => [...prev, newId]);
      setNewTagName("");
      setNewTagColor(TAG_COLORS[0]);
    }
  };

  const _deleteTag = async (tagId: string) => {
    if (!user) return;
    const tag = tags.find((t) => t.id === tagId);
    if (!tag || !window.confirm(`Delete tag "${tag.name}"? It will be removed from all documents.`)) return;
    try {
      const { error } = await supabase.from("tags").delete().eq("id", tagId);
      if (error) throw error;
      setTags((prev) => prev.filter((t) => t.id !== tagId));
      setSelectedTag(selectedTag === tagId ? null : selectedTag);
      toast.success("Tag deleted");
      fetchData();
    } catch (error) {
      console.error("Error deleting tag:", error);
      toast.error("Failed to delete tag");
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

  const currentFolder = selectedFolder ? folders.find((f) => f.id === selectedFolder) : null;
  const currentTag = selectedTag ? tags.find((t) => t.id === selectedTag) : null;
  const breadcrumbSegments = [
    { label: "Dashboard", href: "/dashboard/teacher" },
    { label: "Documents", href: "/dashboard/teacher/documents" },
    ...(currentFolder ? [{ label: currentFolder.name, href: null }] : []),
    ...(currentTag ? [{ label: `Tag: ${currentTag.name}`, href: null }] : []),
  ];
  const listTitle = currentTag
    ? `Documents tagged "${currentTag.name}"`
    : currentFolder
      ? currentFolder.name
      : "All documents";

  const storagePercentage = (storageUsed / storageLimit) * 100;

  return (
    <DashboardLayout>
      <div className="flex gap-6 h-[calc(100vh-7rem)]">
        {/* Left Sidebar - Folders */}
        <div className="w-64 flex-shrink-0 flex flex-col">

          <div className="flex-1 overflow-auto space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Folders
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-md"
                  onClick={() => setNewFolderDialogOpen(true)}
                  aria-label="New folder"
                >
                  <FolderPlus className="w-4 h-4" />
                </Button>
              </div>
              <nav className="space-y-0.5" aria-label="Folder navigation">
                <button
                  onClick={() => setSelectedFolder(null)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    selectedFolder === null
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  <Folder className="w-4 h-4 shrink-0 text-primary" />
                  <span className="text-sm truncate">All documents</span>
                </button>
                {folders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => setSelectedFolder(folder.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      selectedFolder === folder.id
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    <Folder className="w-4 h-4 shrink-0 text-primary" />
                    <span className="text-sm truncate">{folder.name}</span>
                  </button>
                ))}
                {folders.length === 0 && (
                  <p className="text-xs text-muted-foreground px-3 py-2">
                    No folders yet. Create one to organize.
                  </p>
                )}
              </nav>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Tags
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-md"
                  onClick={() => {
                    setNewTagName("");
                    setNewTagColor(TAG_COLORS[0]);
                    setNewTagDialogOpen(true);
                  }}
                  aria-label="Create tag"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {tags.length === 0 ? (
                <p className="text-xs text-muted-foreground px-3 py-2">
                  No tags yet. Create one to label documents.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant={selectedTag === tag.id ? "default" : "secondary"}
                      className="cursor-pointer shrink-0 transition-colors"
                      style={selectedTag !== tag.id ? { borderColor: tag.color, color: tag.color } : undefined}
                      onClick={() => setSelectedTag(selectedTag === tag.id ? null : tag.id)}
                    >
                      {tag.name}
                      {selectedTag === tag.id && <X className="w-3 h-3 ml-1" />}
                    </Badge>
                  ))}
                </div>
              )}
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
          {/* Breadcrumb + toolbar */}
          <nav aria-label="Breadcrumb" className="flex items-center justify-between gap-4 mb-4 flex-wrap">
            <ol className="flex items-center gap-1.5 text-sm text-muted-foreground flex-wrap">
              {breadcrumbSegments.map((seg, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  {i > 0 && <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground/70" />}
                  {seg.href ? (
                    <Link
                      href={seg.href}
                      className="hover:text-foreground transition-colors flex items-center gap-1"
                    >
                      {i === 0 ? <Home className="w-4 h-4" /> : null}
                      {seg.label}
                    </Link>
                  ) : (
                    <span className="font-medium text-foreground">{seg.label}</span>
                  )}
                </li>
              ))}
            </ol>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search documents..."
                  className="pl-9 w-44 sm:w-52"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search documents"
                />
              </div>
              <div className="flex border border-border rounded-lg overflow-hidden bg-muted/30">
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="icon"
                  className="rounded-none h-9 w-9"
                  onClick={() => setViewMode("grid")}
                  aria-label="Grid view"
                >
                  <Grid3X3 className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="icon"
                  className="rounded-none h-9 w-9"
                  onClick={() => setViewMode("list")}
                  aria-label="List view"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </nav>

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
                ? (currentFolder ? `Uploading to ${currentFolder.name}…` : "Uploading…")
                : isDragActive
                  ? "Drop files here"
                  : "Click to upload or drag and drop"}
            </p>
            <p className="text-sm text-muted-foreground">
              {currentFolder ? `Files will be added to "${currentFolder.name}". ` : ""}
              PDF, Word, Excel, images (max 10MB each)
            </p>
          </div>

          {/* Document list */}
          <div className="flex-1 overflow-auto min-h-0">
            <h2 className="font-semibold text-foreground mb-4">{listTitle}</h2>

            {loading ? (
              <div className="flex items-center justify-center py-12" role="status" aria-label="Loading documents">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground rounded-lg border border-dashed border-border bg-muted/20">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium text-foreground">
                  {documents.length === 0 ? "No documents yet" : "No documents match your filters"}
                </p>
                <p className="text-sm mt-1">
                  {documents.length === 0
                    ? "Upload a file above or create a folder to get started."
                    : "Try a different search, folder, or tag."}
                </p>
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
                            {isPreviewableType(doc.file_type) && (
                              <DropdownMenuItem onClick={() => openPreview(doc)}>
                                <Eye className="w-4 h-4 mr-2" />
                                Preview
                              </DropdownMenuItem>
                            )}
                            {isPdfDocument(doc) && (
                              <DropdownMenuItem onClick={() => openSplitDialog(doc)}>
                                <Scissors className="w-4 h-4 mr-2" />
                                Split pages
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => openTagsDialog(doc)}>
                              <Tag className="w-4 h-4 mr-2" />
                              Edit tags
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openRenameDialog(doc)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openMoveDialog(doc)}>
                              <FolderInput className="w-4 h-4 mr-2" />
                              Move to folder
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openShareDialog(doc)}>
                              <Share2 className="w-4 h-4 mr-2" />
                              Share with Classes
                            </DropdownMenuItem>
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
                      <h4
                        className="font-medium text-sm truncate mb-1 cursor-pointer hover:underline"
                        title={doc.name}
                        onClick={() => isPreviewableType(doc.file_type) && openPreview(doc)}
                        onKeyDown={(e) =>
                          isPreviewableType(doc.file_type) &&
                          (e.key === "Enter" || e.key === " ") &&
                          openPreview(doc)
                        }
                        role={isPreviewableType(doc.file_type) ? "button" : undefined}
                        tabIndex={isPreviewableType(doc.file_type) ? 0 : undefined}
                      >
                        {doc.name}
                      </h4>
                      <p className="text-xs text-muted-foreground mb-3">
                        {formatFileSize(doc.file_size)}
                      </p>
                      <div className="flex items-center justify-between gap-2 mt-2">
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatDate(doc.updated_at)}
                        </span>
                        {doc.tags && doc.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 justify-end min-w-0">
                            {doc.tags.slice(0, 3).map((t) => (
                              <Badge key={t.id} variant="secondary" className="text-xs shrink-0" style={{ borderColor: t.color, color: t.color }}>
                                {t.name}
                              </Badge>
                            ))}
                            {doc.tags.length > 3 && (
                              <span className="text-xs text-muted-foreground">+{doc.tags.length - 3}</span>
                            )}
                          </div>
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
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                        <FileIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4
                          className={`font-medium text-sm truncate ${isPreviewableType(doc.file_type) ? "cursor-pointer hover:underline" : ""}`}
                          onClick={() => isPreviewableType(doc.file_type) && openPreview(doc)}
                          onKeyDown={(e) =>
                            isPreviewableType(doc.file_type) &&
                            (e.key === "Enter" || e.key === " ") &&
                            openPreview(doc)
                          }
                          role={isPreviewableType(doc.file_type) ? "button" : undefined}
                          tabIndex={isPreviewableType(doc.file_type) ? 0 : undefined}
                        >
                          {doc.name}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(doc.file_size)} • {formatDate(doc.updated_at)}
                        </p>
                      </div>
                      {doc.tags && doc.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 shrink-0 max-w-[40%] justify-end">
                          {doc.tags.slice(0, 2).map((t) => (
                            <Badge key={t.id} variant="secondary" className="text-xs" style={{ borderColor: t.color, color: t.color }}>
                              {t.name}
                            </Badge>
                          ))}
                          {doc.tags.length > 2 && <span className="text-xs text-muted-foreground">+{doc.tags.length - 2}</span>}
                        </div>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {isPreviewableType(doc.file_type) && (
                            <DropdownMenuItem onClick={() => openPreview(doc)}>
                              <Eye className="w-4 h-4 mr-2" />
                              Preview
                            </DropdownMenuItem>
                          )}
                          {isPdfDocument(doc) && (
                            <DropdownMenuItem onClick={() => openSplitDialog(doc)}>
                              <Scissors className="w-4 h-4 mr-2" />
                              Split pages
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => openTagsDialog(doc)}>
                            <Tag className="w-4 h-4 mr-2" />
                            Edit tags
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openRenameDialog(doc)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openMoveDialog(doc)}>
                            <FolderInput className="w-4 h-4 mr-2" />
                            Move to folder
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openShareDialog(doc)}>
                            <Share2 className="w-4 h-4 mr-2" />
                            Share with Classes
                          </DropdownMenuItem>
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

      {/* Split PDF Dialog */}
      <Dialog
        open={splitDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setSplitDialogOpen(false);
            setDocumentToSplit(null);
            setSplitPageRange("");
            setSplitNewFileName("");
            setSplitPreviewUrl(null);
            setSplitPageCount(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Split pages</DialogTitle>
            <DialogDescription>
              Create a new PDF from selected pages of &quot;{documentToSplit?.name}&quot;. Enter page numbers or ranges in the text box below (e.g. 1-5, 8, 10-12).
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-2 flex-1 min-h-0">
            <div className="flex flex-col min-h-0">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-sm font-medium">Preview</span>
                {splitPageCountLoading ? (
                  <span className="text-xs text-muted-foreground">Loading…</span>
                ) : splitPageCount != null ? (
                  <span className="text-xs text-muted-foreground">
                    Total: {splitPageCount} page{splitPageCount !== 1 ? "s" : ""}
                  </span>
                ) : null}
              </div>
              <div className="border rounded-lg overflow-hidden bg-muted flex-1 min-h-[400px]">
                {splitPreviewUrl ? (
                  <iframe
                    src={splitPreviewUrl}
                    title={documentToSplit?.name ?? "PDF preview"}
                    className="w-full h-full min-h-[400px]"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full min-h-[400px] text-muted-foreground text-sm">
                    Loading preview…
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <Label htmlFor="split-page-range">Pages to include (text only)</Label>
                <Input
                  id="split-page-range"
                  placeholder="e.g. 1-5, 8, 10-12"
                  value={splitPageRange}
                  onChange={(e) => setSplitPageRange(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSplitPdf()}
                  className="mt-1.5"
                />
                {splitPageRange.trim() && (() => {
                  const pages = parsePageRange(splitPageRange);
                  if (pages === null) {
                    return (
                      <p className="text-xs text-destructive mt-1.5">
                        Invalid format. Use numbers and ranges like 1-5, 8, 10-12.
                      </p>
                    );
                  }
                  if (splitPageCount != null) {
                    const validation = validatePageNumbers(pages, splitPageCount);
                    if (!validation.ok) {
                      return (
                        <p className="text-xs text-destructive mt-1.5">
                          {validation.error}
                        </p>
                      );
                    }
                    return (
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {validation.pages.length} page{validation.pages.length !== 1 ? "s" : ""} selected.
                      </p>
                    );
                  }
                  return (
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {pages.length} page{pages.length !== 1 ? "s" : ""} entered.
                    </p>
                  );
                })()}
              </div>
              <div>
                <Label htmlFor="split-new-filename">New file name</Label>
                <Input
                  id="split-new-filename"
                  placeholder="excerpt.pdf"
                  value={splitNewFileName}
                  onChange={(e) => setSplitNewFileName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSplitPdf()}
                  className="mt-1.5"
                />
              </div>
              <DialogFooter className="flex-row gap-2 sm:gap-0 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSplitDialogOpen(false);
                    setDocumentToSplit(null);
                    setSplitPageRange("");
                    setSplitNewFileName("");
                    setSplitPreviewUrl(null);
                    setSplitPageCount(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSplitPdf}
                  disabled={
                    splitLoading ||
                    !splitPageRange.trim() ||
                    !splitNewFileName.trim() ||
                    !splitNewFileName.toLowerCase().endsWith(".pdf")
                  }
                >
                  {splitLoading ? "Creating…" : "Create PDF"}
                </Button>
              </DialogFooter>
            </div>
          </div>
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
                    <Image
                      src={previewUrl}
                      alt={documentToPreview.name}
                      width={800}
                      height={600}
                      className="max-w-full max-h-[70vh] object-contain mx-auto rounded border border-border"
                      unoptimized
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

      {/* Share Document Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              <Share2 className="w-5 h-5 inline-block mr-2" />
              Share with Classrooms
            </DialogTitle>
            <DialogDescription>
              Select classrooms to share &quot;{documentToShare?.name}&quot; with
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {(!classrooms || classrooms.length === 0) ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No classrooms available</p>
                <p className="text-sm">Create a classroom first to share documents</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {classrooms.map((classroom) => (
                  <div
                    key={classroom.id}
                    className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-secondary/50 transition-colors cursor-pointer"
                    onClick={() => toggleClassroomSelection(classroom.id)}
                  >
                    <Checkbox
                      checked={selectedClassrooms.includes(classroom.id)}
                      onCheckedChange={() => toggleClassroomSelection(classroom.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <Label className="font-medium cursor-pointer">
                        {classroom.name}
                      </Label>
                      {classroom.subject && (
                        <p className="text-sm text-muted-foreground">
                          {classroom.subject}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShareDialogOpen(false);
                setDocumentToShare(null);
                setSelectedClassrooms([]);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleShareDocument}>
              {selectedClassrooms.length > 0
                ? `Share with ${selectedClassrooms.length} class${selectedClassrooms.length > 1 ? "es" : ""}`
                : "Remove all shares"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit tags for document */}
      <Dialog open={tagsDialogOpen} onOpenChange={(open) => !open && setDocumentToTag(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5" />
              Edit tags
            </DialogTitle>
            <DialogDescription>
              Assign tags to &quot;{documentToTag?.name}&quot;
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {tags.length === 0 ? (
              <p className="text-sm text-muted-foreground">Create your first tag below.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <label
                    key={tag.id}
                    className="inline-flex items-center gap-2 cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors hover:bg-secondary/50 has-[:checked]:ring-2 has-[:checked]:ring-primary"
                    style={{ borderColor: tag.color }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTagIdsForDoc.includes(tag.id)}
                      onChange={() => toggleTagForDoc(tag.id)}
                      className="sr-only peer"
                    />
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                    <span>{tag.name}</span>
                  </label>
                ))}
              </div>
            )}
            <div className="border-t pt-4 space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Create new tag and add to this document</Label>
              <div className="flex gap-2 flex-wrap">
                <Input
                  placeholder="Tag name"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateTagAndAddToDoc()}
                  className="flex-1 min-w-[120px]"
                />
                <div className="flex gap-1">
                  {TAG_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewTagColor(c)}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${newTagColor === c ? "border-foreground scale-110" : "border-transparent hover:scale-105"}`}
                      style={{ backgroundColor: c }}
                      aria-label={`Color ${c}`}
                    />
                  ))}
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCreateTagAndAddToDoc}
                  disabled={!newTagName.trim() || createTagLoading}
                >
                  {createTagLoading ? "…" : "Create & add"}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setTagsDialogOpen(false); setDocumentToTag(null); }}>
              Cancel
            </Button>
            <Button onClick={handleSaveDocumentTags} disabled={tagsSaving}>
              {tagsSaving ? "Saving…" : "Save tags"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create tag (standalone) */}
      <Dialog
        open={newTagDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setNewTagName("");
            setNewTagColor(TAG_COLORS[0]);
          }
          setNewTagDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create tag</DialogTitle>
            <DialogDescription>
              Add a tag to organize and filter documents later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="new-tag-name">Name</Label>
              <Input
                id="new-tag-name"
                placeholder="e.g. Syllabus, Answer key"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createTag()}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-sm">Color</Label>
              <div className="flex gap-2 flex-wrap mt-1.5">
                {TAG_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewTagColor(c)}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${newTagColor === c ? "border-foreground scale-110" : "border-transparent hover:scale-105"}`}
                    style={{ backgroundColor: c }}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewTagDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => createTag()} disabled={!newTagName.trim() || createTagLoading}>
              {createTagLoading ? "Creating…" : "Create tag"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default TeacherDocuments;