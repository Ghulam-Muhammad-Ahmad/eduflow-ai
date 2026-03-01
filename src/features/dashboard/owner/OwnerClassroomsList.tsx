import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { School } from "lucide-react";

export default function OwnerClassroomsList() {
  const { workspace, classrooms, tutors, isLoading } = useOwnerWorkspace();
  const tutorMap = new Map(tutors.map((t) => [t.user_id, t.profile?.display_name ?? "Tutor"]));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Classes</h1>
          <p className="text-muted-foreground">
            {workspace?.name ?? "Workspace"} · View all classrooms
          </p>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : classrooms.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <School className="mx-auto h-12 w-12 text-muted-foreground" />
            <h2 className="mt-4 font-semibold">No classrooms yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Classrooms are created by tutors. When they create classes, they will appear here.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card divide-y divide-border">
            {classrooms.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
              >
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-sm text-muted-foreground">{c.subject ?? ""}</p>
                </div>
                <span className="text-sm text-muted-foreground">
                  {tutorMap.get(c.teacher_id) ?? "Tutor"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
