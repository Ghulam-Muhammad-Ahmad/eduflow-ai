import { formatInZone } from "@/lib/timezone";
import {
  CheckCircle2,
  CircleDollarSign,
  ExternalLink,
  MoreHorizontal,
  NotebookPen,
  Pencil,
  RefreshCcw,
  Repeat,
  Trash2,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LectureSession, LectureSessionNote } from "@/hooks/useLectureSessions";
import { toSessionBadgeVariant } from "@/components/lectures/SessionCard";

export type SessionsTableRole = "student" | "teacher" | "owner";

type SessionsTableProps = {
  sessions: LectureSession[];
  role: SessionsTableRole;
  tutorMap?: Map<string, string>;
  classroomMap?: Map<string, string>;
  notesBySession?: Record<string, LectureSessionNote | undefined>;
  onEdit?: (session: LectureSession) => void;
  onCancelSingle?: (session: LectureSession) => void;
  onCancelSeries?: (session: LectureSession) => void;
  onComplete?: (session: LectureSession) => void;
  onEditNotes?: (session: LectureSession) => void;
  onEditFinancials?: (session: LectureSession) => void;
};

export function SessionsTable({
  sessions,
  role,
  tutorMap = new Map(),
  classroomMap = new Map(),
  notesBySession = {},
  onEdit,
  onCancelSingle,
  onCancelSeries,
  onComplete,
  onEditNotes,
  onEditFinancials,
}: SessionsTableProps) {
  const canManage = role === "teacher" || role === "owner";
  const showTutorColumn = role === "owner";

  return (
    <div className="rounded-md border overflow-hidden">
      <div className="overflow-x-auto min-w-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="min-w-[140px] ">Title</TableHead>
              <TableHead className="w-[90px] whitespace-nowrap">Status</TableHead>
              <TableHead className="w-[60px]">Type</TableHead>
              <TableHead className="whitespace-nowrap min-w-[160px]">Date & time</TableHead>
              <TableHead className="min-w-[100px]">Classroom</TableHead>
              {showTutorColumn && (
                <TableHead className="min-w-[90px]">Tutor</TableHead>
              )}
              <TableHead className="min-w-[100px] max-w-[200px]">Description</TableHead>
              <TableHead className="text-right w-[120px] whitespace-nowrap">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((session) => (
              <TableRow key={session.id}>
                <TableCell className="font-medium min-w-0">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="text-wrap whitespace-normal">{session.title}</span>
                    {session.series_id && (
                      <Badge variant="outline" className="gap-1 shrink-0">
                        <Repeat className="h-3 w-3" />
                        Recurring
                      </Badge>
                    )}
                    {session.status === "scheduled" && !session.meeting_url && (
                      <Badge variant="outline" className="shrink-0 border-amber-500/40 text-amber-700 dark:text-amber-300">
                        Meet unavailable
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={toSessionBadgeVariant(session.status)}>
                    {session.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {session.scope_type === "one_to_one" ? (
                    <Badge variant="secondary">1:1</Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">Class</span>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {formatInZone(session.starts_at, session.timezone, "PPp")} <br />{" "}
                  {formatInZone(session.ends_at, session.timezone, "p zzz")}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground min-w-0">
                  {session.classroom_id ? classroomMap.get(session.classroom_id) ?? "—" : "—"}
                </TableCell>
                {showTutorColumn && (
                  <TableCell className="text-sm text-muted-foreground">
                    {tutorMap.get(session.tutor_id) ?? "—"}
                  </TableCell>
                )}
                <TableCell className="max-w-[200px] min-w-0 text-sm text-muted-foreground truncate" title={session.description ?? undefined}>
                  {session.description ? session.description.replace(/\s+/g, " ").trim().slice(0, 60) + (session.description.length > 60 ? "…" : "") : "—"}
                </TableCell>
                <TableCell className="text-right w-[120px] align-middle">
                  <div className="flex items-center justify-end gap-1.5 shrink-0">
                    {session.meeting_url && session.status === "scheduled" && (
                      <Button asChild size="sm" variant="default" className="gap-1 h-8 shrink-0">
                        <a href={session.meeting_url} target="_blank" rel="noreferrer">
                          <Video className="h-3.5 w-3.5" />
                          Join
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    )}
                    {(canManage && (onComplete || onEdit || onCancelSeries || onCancelSingle)) ||
                    (session.status === "completed" && (onEditNotes || onEditFinancials)) ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8 w-8 p-0 shrink-0" aria-label="Session actions">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          {canManage && session.status === "scheduled" && (
                            <>
                              {onComplete && (
                                <DropdownMenuItem onClick={() => onComplete(session)}>
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Mark as complete
                                </DropdownMenuItem>
                              )}
                              {onEdit && (
                                <DropdownMenuItem onClick={() => onEdit(session)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                              )}
                              {session.series_id && onCancelSeries && (
                                <DropdownMenuItem onClick={() => onCancelSeries(session)}>
                                  <RefreshCcw className="h-4 w-4 mr-2" />
                                  Cancel recurring session
                                </DropdownMenuItem>
                              )}
                              {onCancelSingle && (
                                <>
                                  {(onComplete || onEdit || (session.series_id && onCancelSeries)) && <DropdownMenuSeparator />}
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => onCancelSingle(session)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    {session.series_id ? "Cancel one-time session" : "Cancel session"}
                                  </DropdownMenuItem>
                                </>
                              )}
                            </>
                          )}
                          {session.status === "completed" && (
                            <>
                              {onEditNotes && (
                                <DropdownMenuItem onClick={() => onEditNotes(session)}>
                                  <NotebookPen className="h-4 w-4 mr-2" />
                                  {notesBySession[session.id] ? "Edit notes" : "Add notes"}
                                </DropdownMenuItem>
                              )}
                              {onEditFinancials && (
                                <DropdownMenuItem onClick={() => onEditFinancials(session)}>
                                  <CircleDollarSign className="h-4 w-4 mr-2" />
                                  Pricing
                                </DropdownMenuItem>
                              )}
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
