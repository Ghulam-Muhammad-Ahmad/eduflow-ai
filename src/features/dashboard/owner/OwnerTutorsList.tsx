import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, UserPlus, Mail, GraduationCap, ChevronRight } from "lucide-react";

const contractStatusLabel: Record<string, string> = {
  draft: "Draft",
  pending_signature: "Pending signature",
  signed: "Signed",
  change_requested: "Change requested",
};

export default function OwnerTutorsList() {
  const { workspace, tutors, assignedStudents, contractByTutorId, isLoading } = useOwnerWorkspace();

  const studentCountByTutor = (assignedStudents as Array<{ tutor_id: string }>).reduce(
    (acc, s) => {
      acc[s.tutor_id] = (acc[s.tutor_id] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Tutors</h1>
            <p className="text-muted-foreground">
              {workspace?.name ?? "Workspace"} · Manage tutors in your workspace
            </p>
          </div>
          <Button asChild>
            <Link href="/dashboard/owner/tutors/invite">
              <UserPlus className="mr-2 h-4 w-4" />
              Create tutor account
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : tutors.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground" />
            <h2 className="mt-4 font-semibold">No tutors yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Invite tutors to your workspace to get started. They can create classes and manage students.
            </p>
            <Button asChild className="mt-4">
              <Link href="/dashboard/owner/tutors/invite">Create tutor account</Link>
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-3 font-medium text-muted-foreground text-sm">Tutor</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground text-sm hidden sm:table-cell">Email</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground text-sm">Contract</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground text-sm text-center w-28">Students</th>
                    <th className="w-10 px-2" aria-hidden />
                  </tr>
                </thead>
                <tbody>
                  {tutors.map((t) => {
                    const studentCount = studentCountByTutor[t.user_id] ?? 0;
                    const name = t.profile?.display_name ?? "Tutor";
                    const email = t.profile?.email ?? "—";
                    const contract = contractByTutorId.get(t.user_id);
                    const status = contract?.contract_status ?? "—";
                    const statusLabel = contractStatusLabel[status] ?? status;
                    return (
                      <tr key={t.id} className="border-b border-border last:border-b-0">
                        <td className="px-4 py-3">
                          <Link
                            href={`/dashboard/owner/tutors/${t.user_id}`}
                            className="flex items-center gap-3 hover:opacity-80 transition-opacity group"
                          >
                            <Avatar className="h-10 w-10 shrink-0">
                              <AvatarImage src={(t.profile as { avatar_url?: string } | undefined)?.avatar_url} />
                              <AvatarFallback className="text-primary font-semibold">{name[0].toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-foreground group-hover:underline">{name}</p>
                              <p className="text-sm text-muted-foreground sm:hidden">{email}</p>
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            {email}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={status === "signed" ? "default" : status === "change_requested" ? "secondary" : "outline"}>
                            {statusLabel}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Link
                            href={`/dashboard/owner/tutors/${t.user_id}`}
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                          >
                            <GraduationCap className="h-4 w-4 shrink-0" aria-hidden />
                            {studentCount}
                          </Link>
                        </td>
                        <td className="px-2 py-3">
                          <Link
                            href={`/dashboard/owner/tutors/${t.user_id}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                            aria-label={`View ${name}`}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
