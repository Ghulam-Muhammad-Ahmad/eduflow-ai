import { Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import type { LectureSession, LectureSessionNote } from "@/hooks/useLectureSessions";
import { SessionsTable, type SessionsTableRole } from "./SessionsTable";

export type SessionFilter = "active" | "completed" | "cancelled" | "all";

export type SessionsListCardRole = "owner" | "teacher";

type ScopeOption = { id: string; name: string };
type OneToOneRoomOption = { id: string; label: string };

export type SessionsListCardProps = {
  role: SessionsListCardRole;
  isLoading: boolean;
  visibleSessions: LectureSession[];
  sessionFilter: SessionFilter;
  onSessionFilterChange: (v: SessionFilter) => void;
  scopeFilter: string;
  onScopeFilterChange: (v: string) => void;
  searchQuery: string;
  onSearchQueryChange: (v: string) => void;
  classrooms: ScopeOption[];
  oneToOneRoomOptions: OneToOneRoomOption[];
  classroomMap: Map<string, string>;
  tutorMap?: Map<string, string>;
  notesBySession: Record<string, LectureSessionNote | undefined>;
  onEdit: (session: LectureSession) => void;
  onCancelSingle: (session: LectureSession) => void;
  onCancelSeries: (session: LectureSession) => void;
  onEditNotes: (session: LectureSession) => void;
  onEditFinancials: (session: LectureSession) => void;
  onComplete?: (session: LectureSession) => void;
};

export function SessionsListCard({
  role,
  isLoading,
  visibleSessions,
  sessionFilter,
  onSessionFilterChange,
  scopeFilter,
  onScopeFilterChange,
  searchQuery,
  onSearchQueryChange,
  classrooms,
  oneToOneRoomOptions,
  classroomMap,
  tutorMap = new Map(),
  notesBySession,
  onEdit,
  onCancelSingle,
  onCancelSeries,
  onEditNotes,
  onEditFinancials,
  onComplete,
}: SessionsListCardProps) {
  const tableRole: SessionsTableRole = role === "owner" ? "owner" : "teacher";

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={sessionFilter} onValueChange={(v: SessionFilter) => onSessionFilterChange(v)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Scheduled</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
            <Select value={scopeFilter} onValueChange={onScopeFilterChange}>
              <SelectTrigger className="w-full sm:w-[240px]">
                <SelectValue placeholder="Select classroom / 1v1 room" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All (classrooms & 1v1 rooms)</SelectItem>
                {classrooms.map((c) => (
                  <SelectItem key={c.id} value={`classroom:${c.id}`}>
                    {c.name}
                  </SelectItem>
                ))}
                {oneToOneRoomOptions.map((r) => (
                  <SelectItem key={r.id} value={`room:${r.id}`}>
                    1v1: {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden />
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Search by title or description..."
              className="pl-9"
              aria-label="Search sessions"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Connect Google Calendar in Settings to schedule lectures.
        </p>
      </div>
      <div className="p-4 sm:px-6">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-lg border bg-secondary/30 animate-pulse" />
            ))}
          </div>
        ) : visibleSessions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
            {searchQuery.trim() || scopeFilter !== "all"
              ? "No sessions match the current filters."
              : "No lecture sessions yet. Connect Google Calendar in Settings, then schedule a lecture."}
          </div>
        ) : (
          <SessionsTable
            sessions={visibleSessions}
            role={tableRole}
            tutorMap={role === "owner" ? tutorMap : undefined}
            classroomMap={classroomMap}
            notesBySession={notesBySession}
            onEdit={onEdit}
            onCancelSingle={onCancelSingle}
            onCancelSeries={onCancelSeries}
            onComplete={onComplete}
            onEditNotes={onEditNotes}
            onEditFinancials={onEditFinancials}
          />
        )}
      </div>
    </div>
  );
}
