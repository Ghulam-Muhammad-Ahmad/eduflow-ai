"use client";

import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useDocCenterMini, type DocCenterDocument } from "@/hooks/useDocCenterMini";
import {
  FileText,
  File,
  Upload,
  FileImage,
  FileSpreadsheet,
  Search,
  Info,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";

/** Extension (lowercase, no dot) -> react-dropzone accept entry */
export const EXTENSION_MIME_MAP: Record<string, { mime: string; ext: string }> = {
  pdf: { mime: "application/pdf", ext: ".pdf" },
  txt: { mime: "text/plain", ext: ".txt" },
  doc: { mime: "application/msword", ext: ".doc" },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: ".docx" },
  xls: { mime: "application/vnd.ms-excel", ext: ".xls" },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext: ".xlsx" },
  ppt: { mime: "application/vnd.ms-powerpoint", ext: ".ppt" },
  pptx: { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", ext: ".pptx" },
  png: { mime: "image/png", ext: ".png" },
  jpg: { mime: "image/jpeg", ext: ".jpg" },
  jpeg: { mime: "image/jpeg", ext: ".jpeg" },
  svg: { mime: "image/svg+xml", ext: ".svg" },
};

const ACCEPT_ALL: Record<string, string[]> = (() => {
  const out: Record<string, string[]> = {};
  for (const v of Object.values(EXTENSION_MIME_MAP)) {
    if (!out[v.mime]) out[v.mime] = [];
    out[v.mime].push(v.ext);
  }
  return out;
})();

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

/** Build react-dropzone accept from allowed extensions (e.g. ['pdf','doc','docx','txt']). */
function buildAccept(allowedFormats: string[] | undefined): Record<string, string[]> {
  if (!allowedFormats?.length) return ACCEPT_ALL;
  const normalized = allowedFormats.map((f) => f.replace(/^\./, "").toLowerCase());
  const accept: Record<string, string[]> = {};
  for (const ext of normalized) {
    const entry = EXTENSION_MIME_MAP[ext];
    if (entry) {
      if (!accept[entry.mime]) accept[entry.mime] = [];
      accept[entry.mime].push(entry.ext);
    }
  }
  return Object.keys(accept).length ? accept : ACCEPT_ALL;
}

/** Get file extension from name (lowercase, no dot). */
function getExtension(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return ext;
}

/** Format allowed extensions for display (e.g. ['pdf','doc'] -> 'PDF, DOC'). */
function formatAllowedDisplay(allowedFormats: string[]): string {
  return allowedFormats
    .map((f) => f.replace(/^\./, "").toUpperCase())
    .join(", ");
}

function getFileIcon(fileType: string) {
  if (fileType.includes("pdf")) return FileText;
  if (fileType.includes("image")) return FileImage;
  if (fileType.includes("spreadsheet") || fileType.includes("excel") || fileType.includes("xlsx"))
    return FileSpreadsheet;
  if (fileType.includes("document") || fileType.includes("docx") || fileType.includes("word"))
    return FileText;
  return File;
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export type DocCenterSelection = { type: "document"; doc: DocCenterDocument } | { type: "file"; file: File };

export interface DocCenterMiniProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect?: (selection: DocCenterSelection) => void;
  /**
   * Allowed file extensions (no dot, case-insensitive). e.g. ['pdf','txt','doc','docx'].
   * When set, only these formats can be uploaded and only matching documents are shown.
   * When undefined, all supported formats are allowed.
   */
  allowedFormats?: string[];
}

export function DocCenterMini({ open, onOpenChange, onSelect, allowedFormats }: DocCenterMiniProps) {
  const { toast } = useToast();
  const {
    documents,
    isLoading,
    upload,
    isUploading,
  } = useDocCenterMini(open);

  const [searchQuery, setSearchQuery] = useState("");

  const dropzoneAccept = useMemo(() => buildAccept(allowedFormats), [allowedFormats]);
  const allowedSet = useMemo(
    () =>
      allowedFormats?.length
        ? new Set(allowedFormats.map((f) => f.replace(/^\./, "").toLowerCase()))
        : null,
    [allowedFormats]
  );
  const documentsFiltered = useMemo(() => {
    if (!allowedSet) return documents;
    return documents.filter((doc) => allowedSet.has(getExtension(doc.name)));
  }, [documents, allowedSet]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;
      const file = acceptedFiles[0];
      if (allowedSet && !allowedSet.has(getExtension(file.name))) {
        toast({
          title: "Invalid file",
          description: `Only these formats are allowed: ${formatAllowedDisplay(allowedFormats ?? [])}.`,
          variant: "destructive",
        });
        return;
      }
      try {
        await upload({ file });
        toast({ title: "Uploaded", description: `"${file.name}" added to your documents.` });
      } catch (e) {
        toast({
          title: "Upload failed",
          description: e instanceof Error ? e.message : "Could not upload file.",
          variant: "destructive",
        });
      }
    },
    [upload, toast, allowedSet, allowedFormats]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: dropzoneAccept,
    maxSize: MAX_SIZE,
    maxFiles: 1,
    disabled: isUploading,
  });

  const handleSelectDocument = (doc: DocCenterDocument) => {
    onSelect?.({ type: "document", doc });
    onOpenChange(false);
  };

  const documentsFilteredBySearch = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return documentsFiltered;
    return documentsFiltered.filter((doc) => doc.name.toLowerCase().includes(q));
  }, [documentsFiltered, searchQuery]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Doc Center</DialogTitle>
        </DialogHeader>

        {/* Upload area */}
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
            ${isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"}
          `}
        >
          <input {...getInputProps()} />
          {isUploading ? (
            <div className="flex flex-col items-center gap-2">
              <Spinner size="lg" className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Uploading...</p>
            </div>
          ) : (
            <>
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">
                {isDragActive ? "Drop the file here" : "Drag & drop a file here, or click to browse"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {allowedFormats?.length
                  ? `Allowed: ${formatAllowedDisplay(allowedFormats)} (max ${MAX_SIZE / 1024 / 1024}MB)`
                  : `PDF, Word, Excel, PowerPoint, images (max ${MAX_SIZE / 1024 / 1024}MB)`}
              </p>
            </>
          )}
        </div>

        {/* Tip: large docs → split for better results */}
        <p className="flex items-center gap-2 text-xs text-black rounded-md bg-slime-lime px-3 py-2">
          <Info className="h-3.5 w-3.5 shrink-0" />
          <span>
            For large documents, use the <strong>Split pages</strong> option in Documents to create smaller PDFs for better results.
          </span>
        </p>


        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>



        {/* File list */}
        <div className="flex-1 min-h-0 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="lg" className="text-muted-foreground" />
            </div>
          ) : documentsFilteredBySearch.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {documentsFiltered.length === 0
                ? documents.length === 0
                  ? "No documents yet. Upload a file above or add from the Documents page."
                  : allowedFormats?.length
                    ? `No documents with allowed formats (${formatAllowedDisplay(allowedFormats)}).`
                    : "No documents yet. Upload a file above or add from the Documents page."
                : searchQuery.trim()
                  ? "No files match your search."
                  : "No documents yet. Upload a file above or add from the Documents page."}
            </div>
          ) : (
            <ul className="space-y-1">
              {documentsFilteredBySearch.map((doc) => {
                const Icon = getFileIcon(doc.file_type);
                return (
                  <li key={doc.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectDocument(doc)}
                      className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted transition-colors"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-muted">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(doc.file_size)}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default DocCenterMini;
