import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Download, Paperclip, Eye } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type AttachedDocument = {
  id: string;
  name: string;
  file_path: string;
  file_type?: string | null;
  file_size?: number | null;
};

/** Rows as returned by the `assignment_attachments` / `quiz_attachments` embeds. */
type AttachmentRow = { document_id?: string; documents?: AttachedDocument | null };

/** Pull the `documents` rows out of an attachment embed, dropping any RLS-hidden ones. */
export function toAttachedDocuments(rows: AttachmentRow[] | null | undefined): AttachedDocument[] {
  return (rows ?? [])
    .map((row) => row.documents)
    .filter((doc): doc is AttachedDocument => !!doc && !!doc.file_path);
}

function formatFileSize(bytes: number | null | undefined): string | null {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return null;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(1))} ${units[i]}`;
}

const isPreviewable = (doc: AttachedDocument) => {
  const type = (doc.file_type ?? "").toLowerCase();
  const name = doc.name.toLowerCase();
  return type.includes("pdf") || type.startsWith("image/") || name.endsWith(".pdf");
};

/**
 * Reference materials (PDF/Word/etc.) a tutor attached to an assignment or quiz.
 * Files live in the private `documents` bucket, so both preview and download go
 * through the authenticated storage client rather than a public URL.
 */
export function AttachedDocuments({
  documents,
  title = "Attached materials",
  emptyLabel,
  compact = false,
}: {
  documents: AttachedDocument[];
  title?: string;
  /** Rendered instead of the list when there is nothing attached. Omit to render nothing. */
  emptyLabel?: string;
  /** Chip-style buttons instead of full rows. */
  compact?: boolean;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const download = async (doc: AttachedDocument) => {
    setBusyId(doc.id);
    try {
      const { data, error } = await supabase.storage.from("documents").download(doc.file_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = doc.name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading attachment:", error);
      toast.error("Failed to download document");
    } finally {
      setBusyId(null);
    }
  };

  const preview = async (doc: AttachedDocument) => {
    setBusyId(doc.id);
    try {
      const { data, error } = await supabase.storage
        .from("documents")
        .createSignedUrl(doc.file_path, 60 * 10);
      if (error || !data?.signedUrl) throw error ?? new Error("Could not open document");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Error previewing attachment:", error);
      toast.error("Failed to open document");
    } finally {
      setBusyId(null);
    }
  };

  if (documents.length === 0) {
    return emptyLabel ? <p className="text-sm text-muted-foreground italic">{emptyLabel}</p> : null;
  }

  if (compact) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5" />
          {title}
        </p>
        <div className="flex flex-wrap gap-2">
          {documents.map((doc) => (
            <Button
              key={doc.id}
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              disabled={busyId === doc.id}
              onClick={(e) => {
                e.stopPropagation();
                download(doc);
              }}
            >
              {busyId === doc.id ? <Spinner size="sm" /> : <FileText className="w-3.5 h-3.5" />}
              <span className="truncate max-w-[140px]">{doc.name}</span>
              <Download className="w-3 h-3 shrink-0" />
            </Button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        <Paperclip className="w-3.5 h-3.5" />
        {title}
      </p>
      <ul className="space-y-2">
        {documents.map((doc) => {
          const size = formatFileSize(doc.file_size);
          return (
            <li
              key={doc.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-muted">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{doc.name}</p>
                {size && <p className="text-xs text-muted-foreground">{size}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {isPreviewable(doc) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5"
                    disabled={busyId === doc.id}
                    onClick={() => preview(doc)}
                  >
                    <Eye className="h-4 w-4" />
                    <span className="hidden sm:inline">View</span>
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={busyId === doc.id}
                  onClick={() => download(doc)}
                >
                  {busyId === doc.id ? <Spinner size="sm" /> : <Download className="h-4 w-4" />}
                  <span className="hidden sm:inline">Download</span>
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default AttachedDocuments;
