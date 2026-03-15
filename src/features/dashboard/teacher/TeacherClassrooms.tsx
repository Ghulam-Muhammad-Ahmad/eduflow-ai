import { useState, useMemo } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useClassrooms, useClassroomRoster, useClassroomStudentCounts } from "@/hooks/useClassrooms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, BookOpen, Settings, Search, Eye } from "lucide-react";

const TeacherClassrooms = () => {
  const { classrooms, isLoading } = useClassrooms();
  const [searchQuery, setSearchQuery] = useState("");
  const [rosterDialogOpen, setRosterDialogOpen] = useState(false);
  const [selectedClassroomId, setSelectedClassroomId] = useState<string | null>(null);

  const classroomIds = useMemo(() => classrooms?.map((c) => c.id) ?? [], [classrooms]);
  const { data: studentCounts = {} } = useClassroomStudentCounts(classroomIds);
  const { data: roster, isLoading: rosterLoading } = useClassroomRoster(selectedClassroomId);

  const selectedClassroom = classrooms?.find((c) => c.id === selectedClassroomId);

  const filteredClassrooms = useMemo(() => {
    if (!classrooms) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return classrooms;
    return classrooms.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.subject?.toLowerCase().includes(q)
    );
  }, [classrooms, searchQuery]);

  const openRoster = (classroomId: string) => {
    setSelectedClassroomId(classroomId);
    setRosterDialogOpen(true);
  };

  return (
    <DashboardLayout role="teacher">
      <div className="min-w-0 w-full max-w-[1600px] mx-auto space-y-10">
        {/* Header — editorial hierarchy */}
        <header className="space-y-1">
          <h1 className="text-[1.75rem] sm:text-2xl font-semibold tracking-[-0.02em] text-foreground">
            My Classrooms
          </h1>
          <p className="text-[0.9375rem] text-muted-foreground max-w-xl">
            Classes are created by your workspace owner. You&apos;ll see them here when assigned.
          </p>
        </header>

        {/* Empty state — refined, atmospheric */}
        {!isLoading && (!classrooms || classrooms.length === 0) && (
          <div
            className="relative rounded-2xl border border-dashed border-border/70 bg-muted/30 overflow-hidden"
            style={{ padding: "clamp(2rem, 5vw, 4rem)" }}
          >
            <div className="flex flex-col items-center justify-center text-center max-w-sm mx-auto">
              <div
                className="rounded-full bg-primary/8 text-primary mb-6 flex items-center justify-center ring-1 ring-primary/10"
                style={{ width: 72, height: 72 }}
              >
                <BookOpen className="w-8 h-8" strokeWidth={1.5} />
              </div>
              <h2 className="text-lg font-medium text-foreground mb-2 tracking-tight">
                No classrooms yet
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Classes are created by your workspace owner. You&apos;ll see them here when you&apos;re assigned.
              </p>
            </div>
          </div>
        )}

        {/* Classrooms table — clean surface, subtle depth */}
        {!isLoading && classrooms && classrooms.length > 0 && (
          <section className="rounded-2xl bg-card border border-border/80 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="px-4 sm:px-5 py-4 border-b border-border/60 bg-muted/20">
              <div className="relative max-w-xs">
                <Search
                  className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/80 pointer-events-none"
                  strokeWidth={1.75}
                  aria-hidden
                />
                <Input
                  type="search"
                  placeholder="Search by class name or subject…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-11 rounded-xl bg-background/80 border-border/80 text-sm placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/30 transition-colors"
                  aria-label="Search classrooms"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/70 bg-muted/25">
                    <th className="px-5 sm:px-6 py-3.5 text-left text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      Class
                    </th>
                    <th className="px-5 sm:px-6 py-3.5 text-left text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground hidden sm:table-cell">
                      Subject
                    </th>
                    <th className="px-5 sm:px-6 py-3.5 text-center text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground w-20">
                      Students
                    </th>
                    <th className="px-5 sm:px-6 py-3.5 text-right text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground w-28 sm:w-36">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredClassrooms.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-5 sm:px-6 py-12 text-center text-sm text-muted-foreground"
                      >
                        No classrooms match &quot;{searchQuery}&quot;. Try a different search.
                      </td>
                    </tr>
                  ) : (
                    filteredClassrooms.map((classroom, index) => {
                      const count = studentCounts[classroom.id] ?? 0;
                      return (
                        <tr
                          key={classroom.id}
                          className="group bg-card hover:bg-muted/30 transition-colors duration-150"
                          style={{
                            animation: "teacher-classrooms-fadeInRow 0.35s ease-out backwards",
                            animationDelay: `${Math.min(index * 40, 200)}ms`,
                          }}
                        >
                          <td className="px-5 sm:px-6 py-3.5">
                            <Link
                              href={`/dashboard/teacher/classrooms/${classroom.id}`}
                              className="font-medium text-foreground hover:text-primary transition-colors inline-block"
                            >
                              {classroom.name}
                            </Link>
                            {classroom.subject && (
                              <p className="text-muted-foreground/90 text-xs sm:hidden mt-0.5">
                                {classroom.subject}
                              </p>
                            )}
                          </td>
                          <td className="px-5 sm:px-6 py-3.5 text-muted-foreground hidden sm:table-cell">
                            {classroom.subject ?? "—"}
                          </td>
                          <td className="px-5 sm:px-6 py-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => openRoster(classroom.id)}
                              className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-primary hover:text-primary/90 hover:underline underline-offset-2 transition-colors"
                            >
                              <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              {count}
                            </button>
                          </td>
                          <td className="px-5 sm:px-6 py-3.5">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="default"
                                size="sm"
                                asChild
                                className="gap-2 rounded-lg font-medium shadow-sm"
                              >
                                <Link
                                  href={`/dashboard/teacher/classrooms/${classroom.id}`}
                                  className="inline-flex items-center gap-2"
                                  aria-label={`View ${classroom.name}`}
                                >
                                  <Eye className="h-4 w-4" strokeWidth={1.75} />
                                  View
                                </Link>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                asChild
                                className="gap-2 rounded-lg border-border/80 bg-background/50 hover:bg-muted/50 shrink-0"
                              >
                                <Link
                                  href={`/dashboard/teacher/classrooms/${classroom.id}#classroom-settings`}
                                  aria-label="Classroom settings"
                                >
                                  <Settings className="h-4 w-4" strokeWidth={1.75} />
                                  Settings
                                </Link>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Loading — staggered skeleton */}
        {isLoading && (
          <section className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-[0_1px_3px_0_rgba(0,0,0,0.04)]">
            <div className="px-4 sm:px-5 py-4 border-b border-border/60">
              <div className="h-11 rounded-xl bg-muted/50 max-w-xs animate-pulse" />
            </div>
            <div className="p-5 sm:p-6 space-y-4">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 h-12"
                  style={{
                    animation: "pulse 1.5s ease-in-out infinite",
                    animationDelay: `${i * 80}ms`,
                  }}
                >
                  <div className="h-4 bg-muted/60 rounded w-[35%] max-w-[180px]" />
                  <div className="h-4 bg-muted/40 rounded w-16 hidden sm:block" />
                  <div className="h-4 bg-muted/40 rounded w-8 ml-auto" />
                  <div className="h-9 bg-muted/50 rounded-lg w-20" />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Roster dialog — refined modal */}
        <Dialog open={rosterDialogOpen} onOpenChange={setRosterDialogOpen}>
          <DialogContent className="max-w-md rounded-2xl border-border/80 shadow-xl p-0 gap-0 overflow-hidden">
            <DialogHeader className="px-5 sm:px-6 pt-6 pb-4 border-b border-border/60 bg-muted/15">
              <DialogTitle className="text-lg font-semibold tracking-tight">
                {selectedClassroom?.name} — Roster
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-1">
                {roster?.length ?? 0} student{(roster?.length ?? 0) !== 1 ? "s" : ""} enrolled
              </DialogDescription>
            </DialogHeader>
            <div className="px-5 sm:px-6 py-4 max-h-[min(70vh,360px)] overflow-y-auto">
              {rosterLoading && (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 animate-pulse"
                    >
                      <div className="w-10 h-10 rounded-full bg-muted/60" />
                      <div className="flex-1">
                        <div className="h-4 bg-muted/50 rounded w-28 mb-1.5" />
                        <div className="h-3 bg-muted/40 rounded w-20" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!rosterLoading && (!roster || roster.length === 0) && (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="rounded-full bg-muted/50 p-4 mb-3">
                    <Users className="w-8 h-8 text-muted-foreground/70" strokeWidth={1.5} />
                  </div>
                  <p className="text-sm font-medium text-foreground/90">No students enrolled yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Students are added by your workspace owner
                  </p>
                </div>
              )}
              {!rosterLoading && roster && roster.length > 0 && (
                <ul className="space-y-2">
                  {roster.map((enrollment) => {
                    const studentName =
                      (enrollment.profiles as { display_name?: string; avatar_url?: string } | null)
                        ?.display_name || "Student";
                    return (
                      <li
                        key={enrollment.id}
                        className="flex items-center gap-3 rounded-xl bg-muted/25 px-3 py-2.5 group/row border border-transparent hover:border-border/50 hover:bg-muted/40 transition-colors"
                      >
                        <Avatar className="h-10 w-10 shrink-0 ring-1 ring-border/50">
                          <AvatarImage
                            src={(enrollment.profiles as { avatar_url?: string } | null)?.avatar_url}
                          />
                          <AvatarFallback className="text-sm font-medium bg-primary/10 text-primary">
                            {(studentName[0] || "S").toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate text-sm">
                            {studentName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Joined {new Date(enrollment.joined_at).toLocaleDateString()}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </DialogContent>
        </Dialog>

      </div>

      <style jsx global>{`
        @keyframes teacher-classrooms-fadeInRow {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </DashboardLayout>
  );
};

export default TeacherClassrooms;
