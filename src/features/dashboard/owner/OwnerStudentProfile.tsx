import { useRouter } from "next/router";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { MemberCreditsCard } from "@/components/credits/MemberCreditsCard";
import { MemberStorageCard } from "@/components/storage/MemberStorageCard";
import { Video } from "lucide-react";

export default function OwnerStudentProfile() {
  const router = useRouter();
  const { id } = router.query;
  const studentId = typeof id === "string" ? id : null;
  const { assignedStudents, tutors, isLoading } = useOwnerWorkspace();

  const assignment = (assignedStudents as Array<{ student_id: string; tutor_id: string; student?: { display_name: string | null; email: string | null } }>).find(
    (s) => s.student_id === studentId
  );
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
      return (data ?? []) as Array<{ classroom_id: string; classrooms: { id: string; name: string; subject: string | null } | null }>;
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/owner/students">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Students
          </Link>
        </Button>

        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-semibold">
              {(assignment?.student?.display_name ?? "S")[0].toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{assignment?.student?.display_name ?? "Student"}</h1>
              <p className="text-muted-foreground">{assignment?.student?.email ?? ""}</p>
            </div>
          </div>
        </div>

        {studentId && (
          <MemberCreditsCard
            memberUserId={studentId}
            memberLabel={assignment?.student?.display_name ?? "Student"}
          />
        )}

        {studentId && (
          <MemberStorageCard
            memberUserId={studentId}
            memberLabel={assignment?.student?.display_name ?? "Student"}
          />
        )}

        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-semibold mb-4">Assigned tutor</h2>
          {tutor ? (
            <Link href={`/dashboard/owner/tutors/${tutor.user_id}`} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{tutor.profile?.display_name ?? "Tutor"}</p>
                <p className="text-sm text-muted-foreground">{tutor.profile?.email ?? ""}</p>
              </div>
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground">Not assigned to a tutor. Assign from the Students list.</p>
          )}
        </div>

        {studentId && (
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-semibold mb-2 flex items-center gap-2">
              <Video className="h-5 w-5 text-primary" />
              One-to-one sessions
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Schedule and manage coaching sessions from the Sessions page.
            </p>
            <Button asChild variant="outline" className="gap-2">
              <Link href="/dashboard/owner/sessions">View and schedule sessions</Link>
            </Button>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-semibold mb-4">Enrolled classrooms</h2>
          {enrollments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not enrolled in any classroom yet.</p>
          ) : (
            <ul className="space-y-2">
              {enrollments.map((e) => (
                <li key={e.classroom_id}>
                  <span className="font-medium">{e.classrooms?.name ?? "—"}</span>
                  {e.classrooms?.subject && <span className="text-muted-foreground text-sm"> · {e.classrooms.subject}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
