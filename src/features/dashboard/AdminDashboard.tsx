import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import {
  Users,
  GraduationCap,
  Building,
  Activity,
  ClipboardCheck,
  FileText,
  ListChecks,
  Shield,
  Settings,
} from "lucide-react";

const AdminDashboard = () => {
  useAuth();
  const { workspace, stats, tutors, assignedStudents, assignments, isLoading } = useOwnerWorkspace();

  const statsCards = [
    { icon: Users, label: "Tutors", value: stats.tutorsCount, path: "/dashboard/owner/tutors", iconClass: "feature-icon-indigo" },
    { icon: GraduationCap, label: "Students", value: stats.studentsCount, path: "/dashboard/owner/students", iconClass: "feature-icon-teal" },
    { icon: Building, label: "Classrooms", value: stats.classroomsCount, path: "/dashboard/owner/classrooms", iconClass: "feature-icon-purple" },
    { icon: ClipboardCheck, label: "Pending to grade", value: stats.pendingSubmissionsCount, path: "/dashboard/owner/assignments", iconClass: "feature-icon-amber" },
  ];

  const recentTutors = tutors.slice(0, 4);
  const recentStudents = assignedStudents.slice(0, 4);
  const recentAssignments = assignments.slice(0, 5);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Owner Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              See and control your whole tutoring operation from here.
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-medium">
            <Shield className="w-4 h-4" />
            Business Owner
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {statsCards.map((stat) => (
            <Link key={stat.label} href={stat.path}>
              <div className="bg-card rounded-2xl border border-border p-6 hover:shadow-lg hover:border-primary/30 transition-all cursor-pointer">
                <div className="flex items-start justify-between mb-4">
                  <div className={stat.iconClass}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                </div>
                <div className="text-3xl font-bold mb-1">
                  {isLoading ? "—" : stat.value}
                </div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Recent Tutors & Students */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-muted-foreground" />
              Tutors & Students
            </h2>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Tutors</p>
                  <div className="space-y-2">
                    {recentTutors.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No tutors yet. Invite from the Tutors page.</p>
                    ) : (
                      recentTutors.map((t) => (
                        <Link key={t.id} href={`/dashboard/owner/tutors/${t.user_id}`} className="block p-3 rounded-xl bg-secondary/30 border border-border hover:bg-secondary/50">
                          <p className="font-medium">{t.profile?.display_name ?? "Tutor"}</p>
                          <p className="text-xs text-muted-foreground">{t.profile?.email ?? ""}</p>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Students</p>
                  <div className="space-y-2">
                    {recentStudents.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No students assigned yet.</p>
                    ) : (
                      recentStudents.map((s) => (
                        <Link key={s.id} href={`/dashboard/owner/students/${s.student_id}`} className="block p-3 rounded-xl bg-secondary/30 border border-border hover:bg-secondary/50">
                          <p className="font-medium">{(s as { student?: { display_name: string | null } }).student?.display_name ?? "Student"}</p>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
                <Link href="/dashboard/owner/tutors" className="text-sm text-primary font-medium hover:underline">
                  View all →
                </Link>
              </div>
            )}
          </div>

          {/* Recent activity / Assignments */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-muted-foreground" />
              Recent Assignments
            </h2>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : (
              <div className="space-y-3">
                {recentAssignments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No assignments in this workspace yet.</p>
                ) : (
                  recentAssignments.map((a) => (
                    <Link
                      key={a.id}
                      href="/dashboard/owner/assignments"
                      className="block p-3 rounded-xl bg-secondary/30 border border-border hover:bg-secondary/50"
                    >
                      <p className="font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {(a as { classrooms?: { name: string } }).classrooms?.name ?? "—"} · {a.status}
                      </p>
                    </Link>
                  ))
                )}
                <Link href="/dashboard/owner/assignments" className="text-sm text-primary font-medium hover:underline">
                  View all assignments →
                </Link>
              </div>
            )}
            <Link href="/dashboard/settings" className="mt-4 block w-full p-3 rounded-xl bg-secondary hover:bg-secondary/80 border border-border font-medium transition-colors text-center">
              <div className="flex items-center justify-center gap-2">
                <Settings className="w-5 h-5" />
                Settings
              </div>
            </Link>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
