import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { Button } from "@/components/ui/button";
import { GraduationCap, UserPlus } from "lucide-react";

type AssignedStudent = {
  id: string;
  student_id: string;
  tutor_id: string;
  student?: { display_name: string | null; email: string | null } | null;
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
              Create student accounts and assign them to tutors. Share login details with them. Students can also join via classroom code.
            </p>
            <Button asChild className="mt-4">
              <Link href="/dashboard/owner/students/invite">Create student account</Link>
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card divide-y divide-border">
            {students.map((s) => {
              const tutor = tutors.find((t) => t.user_id === s.tutor_id);
              return (
                <Link
                  key={s.id}
                  href={`/dashboard/owner/students/${s.student_id}`}
                  className="flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                      {(s.student?.display_name ?? "S")[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{s.student?.display_name ?? "Student"}</p>
                      <p className="text-sm text-muted-foreground">{s.student?.email ?? ""}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Assigned to</p>
                    <p className="font-medium">{tutor?.profile?.display_name ?? "—"}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
