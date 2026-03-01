import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { Button } from "@/components/ui/button";
import { Users, UserPlus } from "lucide-react";

export default function OwnerTutorsList() {
  const { workspace, tutors, isLoading } = useOwnerWorkspace();

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
          <div className="rounded-2xl border border-border bg-card divide-y divide-border">
            {tutors.map((t) => (
              <Link
                key={t.id}
                href={`/dashboard/owner/tutors/${t.user_id}`}
                className="flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                    {(t.profile?.display_name ?? "T")[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium">{t.profile?.display_name ?? "Tutor"}</p>
                    <p className="text-sm text-muted-foreground">{t.profile?.email ?? ""}</p>
                  </div>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">Tutor</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
