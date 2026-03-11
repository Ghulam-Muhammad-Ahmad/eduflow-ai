import { useRouter } from "next/router";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowLeft,
  User,
  Video,
  Pencil,
  MessageSquare,
  UserCircle,
  GraduationCap,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { MemberCreditsCard } from "@/components/credits/MemberCreditsCard";
import { MemberStorageCard } from "@/components/storage/MemberStorageCard";

export default function OwnerStudentProfile() {
  const router = useRouter();
  const { id } = router.query;
  const studentId = typeof id === "string" ? id : null;
  const { workspace, assignedStudents, tutors, isLoading } = useOwnerWorkspace();

  const assignment = (
    assignedStudents as Array<{
      student_id: string;
      tutor_id: string;
      student?: { display_name: string | null; email: string | null; avatar_url?: string | null };
    }>
  ).find((s) => s.student_id === studentId);
  const tutor = assignment ? tutors.find((t) => t.user_id === assignment.tutor_id) : null;

  const { data: enrollments = [] } = useQuery({
    queryKey: ["student-enrollments", studentId],
    queryFn: async () => {
      if (!studentId) return [];
      const { data, error } = await supabase
        .from("enrollments")
        .select("classroom_id, classrooms(id, name, subject)")
        .eq("student_id", studentId)
        .eq("status", "active");
      if (error) throw error;
      return (data ?? []) as Array<{
        classroom_id: string;
        classrooms: { id: string; name: string; subject: string | null } | null;
      }>;
    },
    enabled: !!studentId,
  });

  if (!studentId && !router.isReady) return null;
  if (!isLoading && !assignment) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Button variant="ghost" asChild>
            <Link href="/dashboard/owner/students">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Students
            </Link>
          </Button>
          <p className="text-muted-foreground">Student not found in this workspace.</p>
        </div>
      </DashboardLayout>
    );
  }

  const displayName = assignment?.student?.display_name ?? "Student";
  const email = assignment?.student?.email ?? "";
  const avatarUrl = assignment?.student?.avatar_url ?? undefined;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild aria-label="Back to Students">
            <Link href="/dashboard/owner/students">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Student profile</h1>
            <p className="text-sm text-muted-foreground">
              {workspace?.name ?? "Workspace"} · View and manage student
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main column: credits, storage, tutor, sessions */}
          <div className="space-y-6 lg:col-span-2">
            <div className="grid gap-4 sm:grid-cols-2">
              {studentId && (
                <MemberCreditsCard
                  memberUserId={studentId}
                  memberLabel={displayName}
                  variant="compact"
                  className="h-full"
                />
              )}
              {studentId && (
                <MemberStorageCard
                  memberUserId={studentId}
                  memberLabel={displayName}
                  variant="compact"
                  className="h-full"
                />
              )}
            </div>

            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-medium text-muted-foreground mb-3">Assigned tutor</h2>
              {tutor ? (
                <Link
                  href={`/dashboard/owner/tutors/${tutor.user_id}`}
                  className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">
                      {tutor.profile?.display_name ?? "Tutor"}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {tutor.profile?.email ?? ""}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Not assigned to a tutor. Assign from the Students list.
                </p>
              )}
            </section>

            {studentId && (
              <section className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  One-to-one sessions
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Schedule and manage coaching sessions from the Sessions page.
                </p>
                <Button variant="outline" size="sm" asChild className="gap-2">
                  <Link href="/dashboard/owner/sessions">View and schedule sessions</Link>
                </Button>
              </section>
            )}
          </div>

          {/* Sidebar: Student detail card + Enrolled classrooms */}
          <div className="space-y-6">
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
                Student detail
              </h2>
              <div className="flex flex-col items-center text-center">
                <Avatar className="h-20 w-20 rounded-full border-2 border-border">
                  <AvatarImage src={avatarUrl} alt="" />
                  <AvatarFallback className="bg-muted text-lg font-semibold text-foreground">
                    {displayName[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="mt-3 flex items-center justify-center gap-1.5">
                  <span className="font-semibold text-foreground">{displayName}</span>
                  <button
                    type="button"
                    className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Edit name"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {email || "Student"}
                </p>
                <div className="mt-4 flex w-full gap-2">
                  <Button variant="outline" size="sm" className="flex-1 gap-1.5" asChild>
                    <Link href="/dashboard/owner/sessions">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Sessions
                    </Link>
                  </Button>
                  {tutor && (
                    <Button size="sm" className="flex-1 gap-1.5" asChild>
                      <Link href={`/dashboard/owner/tutors/${tutor.user_id}`}>
                        <UserCircle className="h-3.5 w-3.5" />
                        Tutor
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
                Enrolled classrooms
              </h2>
              {enrollments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Not enrolled in any classroom yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {enrollments.map((e) => (
                    <li key={e.classroom_id}>
                      <Link
                        href={`/dashboard/owner/classrooms/${e.classroom_id}`}
                        className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3 transition-colors hover:bg-muted/50"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                          <GraduationCap className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground">
                            {e.classrooms?.name ?? "—"}
                          </p>
                          {e.classrooms?.subject && (
                            <p className="text-xs text-muted-foreground">
                              {e.classrooms.subject}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
