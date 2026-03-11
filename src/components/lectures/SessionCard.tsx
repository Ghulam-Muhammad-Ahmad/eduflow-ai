import { format } from "date-fns";
import {
  CheckCircle2,
  CircleDollarSign,
  ExternalLink,
  NotebookPen,
  Pencil,
  RefreshCcw,
  Repeat,
  Trash2,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LectureSession, LectureSessionNote } from "@/hooks/useLectureSessions";

export function toSessionBadgeVariant(status: string) {
  if (status === "cancelled") return "destructive" as const;
  if (status === "completed") return "secondary" as const;
  return "default" as const;
}

type SessionCardProps = {
  session: LectureSession;
  tutorName?: string;
  canManage: boolean;
  canCompleteOutcomes: boolean;
  canEditPrivateNotes: boolean;
  canEditMockFinancials: boolean;
  showPrivateNotes: boolean;
  onEdit: (session: LectureSession) => void;
  onCancelSingle: (session: LectureSession) => void;
  onCancelSeries: (session: LectureSession) => void;
  onComplete: (session: LectureSession) => void;
  onEditNotes: (session: LectureSession) => void;
  onEditFinancials: (session: LectureSession) => void;
  note?: LectureSessionNote;
};

export function SessionCard({
  session,
  tutorName,
  canManage,
  canCompleteOutcomes,
  canEditPrivateNotes,
  canEditMockFinancials,
  showPrivateNotes,
  onEdit,
  onCancelSingle,
  onCancelSeries,
  onComplete,
  onEditNotes,
  onEditFinancials,
  note,
}: SessionCardProps) {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold truncate">{session.title}</p>
            <Badge variant={toSessionBadgeVariant(session.status)}>
              {session.status}
            </Badge>
            {session.series_id && (
              <Badge variant="outline" className="gap-1">
                <Repeat className="h-3 w-3" />
                Recurring
              </Badge>
            )}
            {session.scope_type === "one_to_one" && (
              <Badge variant="secondary">1:1</Badge>
            )}
            {session.status === "scheduled" && !session.meeting_url && (
              <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300">
                Meet unavailable
              </Badge>
            )}
          </div>
          <div className="mt-1 text-sm text-muted-foreground space-y-1">
            <p>{format(new Date(session.starts_at), "PPp")} to {format(new Date(session.ends_at), "PPp")}</p>
            {tutorName && <p>Tutor: {tutorName}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {session.meeting_url && session.status === "scheduled" && (
            <Button asChild size="sm" className="gap-2">
              <a href={session.meeting_url} target="_blank" rel="noreferrer">
                <Video className="h-4 w-4" />
                Join Meet
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}
          {canManage && session.status === "scheduled" && (
            <>
              {canCompleteOutcomes && (
                <Button variant="outline" size="sm" className="gap-2" onClick={() => onComplete(session)}>
                  <CheckCircle2 className="h-4 w-4" />
                  Mark completed
                </Button>
              )}
              <Button variant="outline" size="sm" className="gap-2" onClick={() => onEdit(session)}>
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
              {session.series_id && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => onCancelSeries(session)}
                >
                  <RefreshCcw className="h-4 w-4" />
                  Cancel series
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-destructive hover:text-destructive"
                onClick={() => onCancelSingle(session)}
              >
                <Trash2 className="h-4 w-4" />
                {session.series_id ? "Cancel occurrence" : "Cancel"}
              </Button>
            </>
          )}
          {session.status === "completed" && canEditPrivateNotes && (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => onEditNotes(session)}>
              <NotebookPen className="h-4 w-4" />
              {note ? "Edit notes" : "Add notes"}
            </Button>
          )}
          {session.status === "completed" && canEditMockFinancials && (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => onEditFinancials(session)}>
              <CircleDollarSign className="h-4 w-4" />
              Pricing inputs
            </Button>
          )}
        </div>
      </div>
      {session.description && (
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
          {session.description}
        </p>
      )}
      {!session.meeting_url && (
        <p className="text-sm text-amber-600">
          No Google Meet link is available for this lecture yet.
        </p>
      )}
      {showPrivateNotes && session.status === "completed" && (
        <div className="rounded-md border bg-muted/20 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Private tutor notes
          </p>
          <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
            {note?.content?.trim() || "No private tutor notes have been added yet."}
          </p>
        </div>
      )}
    </div>
  );
}
