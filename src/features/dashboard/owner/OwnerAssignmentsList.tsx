import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { ClipboardCheck } from "lucide-react";

type AssignmentRow = {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  classrooms?: { id: string; name: string; subject: string | null } | null;
};

export default function OwnerAssignmentsList() {
  const { workspace, assignments, isLoading } = useOwnerWorkspace();
  const list = assignments as AssignmentRow[];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Assignments</h1>
          <p className="text-muted-foreground">
            {workspace?.name ?? "Workspace"} · View all assignments
          </p>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : list.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <ClipboardCheck className="mx-auto h-12 w-12 text-muted-foreground" />
            <h2 className="mt-4 font-semibold">No assignments yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Assignments created by tutors will appear here.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card divide-y divide-border">
            {list.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
              >
                <div>
                  <p className="font-medium">{a.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {a.classrooms?.name ?? "—"} · Due {a.due_date ? new Date(a.due_date).toLocaleDateString() : "—"}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  a.status === "published" ? "bg-green-500/10 text-green-700 dark:text-green-400" :
                  a.status === "draft" ? "bg-muted text-muted-foreground" : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                }`}>
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
