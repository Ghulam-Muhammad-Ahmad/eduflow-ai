import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GraduationCap, UserPlus, Pencil } from "lucide-react";

type AssignedStudent = {
  id: string;
  student_id: string;
  tutor_id: string;
  student?: { display_name: string | null; email: string | null; avatar_url?: string | null } | null;
};

export default function OwnerStudentsList() {
  const { workspace, assignedStudents, tutors, isLoading } = useOwnerWorkspace();
  const students = assignedStudents as AssignedStudent[];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Students</h1>
            <p className="text-muted-foreground">
              {workspace?.name ?? "Workspace"} · Assign students to tutors
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/dashboard/owner/students/invite">
              <UserPlus className="mr-2 h-4 w-4" />
              Create student account
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : students.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <GraduationCap className="mx-auto h-12 w-12 text-muted-foreground" />
            <h2 className="mt-4 font-semibold">No students assigned yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Create student accounts and assign them to tutors. Share login details with them.
            </p>
            <Button asChild className="mt-4">
              <Link href="/dashboard/owner/students/invite">Create student account</Link>
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/80 bg-muted/30">
                    <th className="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Student
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Email
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Assigned to
                    </th>
                    <th className="px-6 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground w-24">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {students.map((s) => {
                    const tutor = tutors.find((t) => t.user_id === s.tutor_id);
                    return (
                      <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-3.5">
                          <Link
                            href={`/dashboard/owner/students/${s.student_id}`}
                            className="flex items-center gap-3 font-medium text-foreground hover:text-primary transition-colors"
                          >
                            <Avatar className="h-9 w-9 rounded-full border border-border">
                              <AvatarImage src={s.student?.avatar_url ?? undefined} alt="" />
                              <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                                {(s.student?.display_name ?? "S")[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            {s.student?.display_name ?? "Student"}
                          </Link>
                        </td>
                        <td className="px-6 py-3.5 text-muted-foreground">
                          {s.student?.email ?? "—"}
                        </td>
                        <td className="px-6 py-3.5 text-muted-foreground">
                          {tutor?.profile?.display_name ?? tutor?.profile?.email ?? "—"}
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" asChild>
                            <Link href={`/dashboard/owner/students/${s.student_id}`} aria-label="View student">
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
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
