import { useRouter } from "next/router";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Users, School, ClipboardCheck, FileText } from "lucide-react";
import { MemberCreditsCard } from "@/components/credits/MemberCreditsCard";

export default function OwnerTutorProfile() {
  const router = useRouter();
  const { id } = router.query;
  const tutorId = typeof id === "string" ? id : null;
  const { tutors, assignedStudents, classrooms, assignments, contractByTutorId, isLoading } = useOwnerWorkspace();

  const tutor = tutors.find((t) => t.user_id === tutorId);
  const contract = tutorId ? contractByTutorId.get(tutorId) : null;

  const assignedToThisTutor = (assignedStudents as Array<{ tutor_id: string; student_id: string; student?: { display_name: string | null } }>).filter(
    (s) => s.tutor_id === tutorId
  );
  const tutorClassrooms = classrooms.filter((c) => c.teacher_id === tutorId);
  const tutorAssignments = assignments.filter((a) => a.teacher_id === tutorId);

  if (!tutorId && !router.isReady) return null;
  if (!isLoading && !tutor) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Button variant="ghost" asChild>
            <Link href="/dashboard/owner/tutors">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Tutors
            </Link>
          </Button>
          <p className="text-muted-foreground">Tutor not found.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/owner/tutors">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Tutors
          </Link>
        </Button>

        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-start gap-4">
            <Avatar className="h-14 w-14 shrink-0">
              <AvatarImage src={(tutor?.profile as { avatar_url?: string } | undefined)?.avatar_url} />
              <AvatarFallback className="text-primary text-xl font-semibold">
                {(tutor?.profile?.display_name ?? "T")[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold">{tutor?.profile?.display_name ?? "Tutor"}</h1>
              <p className="text-muted-foreground">{tutor?.profile?.email ?? ""}</p>
              <span className="inline-block mt-2 text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">Tutor</span>
              {contract && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Rate: {contract.rate_amount} {contract.rate_currency} per {contract.pay_type === "per_session" ? "session" : "hour"}
                </p>
              )}
              {contract?.subjects && Array.isArray(contract.subjects) && (contract.subjects as string[]).length > 0 && (
                <p className="text-sm text-muted-foreground">Subjects: {(contract.subjects as string[]).join(", ")}</p>
              )}
              {(tutor?.profile as { bio?: string } | undefined)?.bio && (
                <p className="mt-2 text-sm text-foreground">{(tutor?.profile as { bio?: string }).bio}</p>
              )}
            </div>
          </div>
        </div>

        {contract && (
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Contract
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {contract.contract_signed_at
                ? `Signed on ${new Date(contract.contract_signed_at).toLocaleDateString()} by ${contract.tutor_signature_name ?? "—"}.`
                : "View and manage this tutor's contract from the Contracts tab."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="default" asChild>
                <Link href={`/dashboard/owner/contracts/${contract.id}`}>
                  <FileText className="mr-2 h-4 w-4" />
                  {contract.contract_body_text ? "View contract" : "Create contract"}
                </Link>
              </Button>
              {!contract.contract_body_text && (
                <Button variant="outline" asChild>
                  <Link href={`/dashboard/owner/contracts/new?tutorId=${tutorId}`}>
                    Build AI contract
                  </Link>
                </Button>
              )}
            </div>
          </div>
        )}

        {tutorId && (
          <MemberCreditsCard
            memberUserId={tutorId}
            memberLabel={tutor?.profile?.display_name ?? "Tutor"}
          />
        )}

        <div className="grid sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <Users className="h-5 w-5 text-muted-foreground mb-2" />
            <p className="text-2xl font-bold">{assignedToThisTutor.length}</p>
            <p className="text-sm text-muted-foreground">Assigned students</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <School className="h-5 w-5 text-muted-foreground mb-2" />
            <p className="text-2xl font-bold">{tutorClassrooms.length}</p>
            <p className="text-sm text-muted-foreground">Classrooms</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <ClipboardCheck className="h-5 w-5 text-muted-foreground mb-2" />
            <p className="text-2xl font-bold">{tutorAssignments.length}</p>
            <p className="text-sm text-muted-foreground">Assignments</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-semibold mb-4">Assigned students</h2>
          {assignedToThisTutor.length === 0 ? (
            <p className="text-sm text-muted-foreground">No students assigned yet.</p>
          ) : (
            <ul className="space-y-2">
              {assignedToThisTutor.map((s) => (
                <li key={s.student_id}>
                  <Link href={`/dashboard/owner/students/${s.student_id}`} className="text-primary hover:underline">
                    {s.student?.display_name ?? "Student"}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-semibold mb-4">Classrooms</h2>
          {tutorClassrooms.length === 0 ? (
            <p className="text-sm text-muted-foreground">No classrooms yet.</p>
          ) : (
            <ul className="space-y-2">
              {tutorClassrooms.map((c) => (
                <li key={c.id}>
                  <span className="font-medium">{c.name}</span>
                  {c.subject && <span className="text-muted-foreground text-sm"> · {c.subject}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
