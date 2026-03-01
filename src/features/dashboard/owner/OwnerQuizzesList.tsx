import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { ListChecks } from "lucide-react";

type QuizRow = {
  id: string;
  title: string;
  status: string | null;
  classroom?: { id: string; name: string; subject: string | null } | null;
};

export default function OwnerQuizzesList() {
  const { workspace, quizzes, isLoading } = useOwnerWorkspace();
  const list = quizzes as QuizRow[];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Quizzes</h1>
          <p className="text-muted-foreground">
            {workspace?.name ?? "Workspace"} · View all quizzes
          </p>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : list.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <ListChecks className="mx-auto h-12 w-12 text-muted-foreground" />
            <h2 className="mt-4 font-semibold">No quizzes yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Quizzes created by tutors will appear here.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card divide-y divide-border">
            {list.map((q) => (
              <div
                key={q.id}
                className="flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
              >
                <div>
                  <p className="font-medium">{q.title}</p>
                  <p className="text-sm text-muted-foreground">{q.classroom?.name ?? "—"}</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                  {q.status ?? "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
