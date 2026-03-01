import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { FileText } from "lucide-react";

export default function OwnerDocumentsList() {
  const { workspace, documents, tutors, isLoading } = useOwnerWorkspace();
  const ownerId = workspace?.owner_id;
  const tutorIds = new Set(tutors.map((t) => t.user_id));
  const getUploader = (userId: string) => {
    if (userId === ownerId) return "Owner";
    const t = tutors.find((x) => x.user_id === userId);
    return t?.profile?.display_name ?? "Tutor";
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Documents</h1>
          <p className="text-muted-foreground">
            {workspace?.name ?? "Workspace"} · Workspace document library
          </p>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : documents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
            <h2 className="mt-4 font-semibold">No documents yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Documents uploaded by you and tutors will appear here.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card divide-y divide-border">
            {documents.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{d.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {d.file_type ?? "—"} · {getUploader(d.user_id)}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {d.file_size ? `${(d.file_size / 1024).toFixed(1)} KB` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
