import { useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Users,
  GraduationCap,
  Building,
  Shield,
  Settings,
  PenLine,
  School,
  ScrollText,
  UserRound,
  Video,
  Building2,
  CreditCard,
  Wallet,
  FileText,
  ClipboardCheck,
  ListChecks,
  ChevronDown,
} from "lucide-react";

const dashboardFeatures = [
  { label: "Tutors", description: "Invite and manage tutors, view profiles and contracts.", path: "/dashboard/owner/tutors", icon: Users },
  { label: "Contracts", description: "Create, view, and sign tutor contracts.", path: "/dashboard/owner/contracts", icon: PenLine },
  { label: "Students", description: "Invite students and view profiles, rooms, and sessions.", path: "/dashboard/owner/students", icon: GraduationCap },
  { label: "Classes", description: "Manage classrooms and enrollments.", path: "/dashboard/owner/classrooms", icon: School },
  { label: "Student Records", description: "View and filter student records by class or 1v1 room.", path: "/dashboard/owner/student-records", icon: ScrollText },
  { label: "1v1 Rooms", description: "View one-to-one rooms and link to student records.", path: "/dashboard/owner/rooms", icon: UserRound },
  { label: "Sessions", description: "All workspace sessions, notes, and financials.", path: "/dashboard/owner/sessions", icon: Video },
  { label: "Documents", description: "Workspace-level documents.", path: "/dashboard/owner/documents", icon: FileText },
  { label: "Assignments", description: "Workspace-level assignments.", path: "/dashboard/owner/assignments", icon: ClipboardCheck },
  { label: "Quizzes", description: "Workspace-level quizzes.", path: "/dashboard/owner/quizzes", icon: ListChecks },
  { label: "Workspace", description: "Workspace name, logo, and default currency.", path: "/dashboard/owner/workspace", icon: Building2 },
  { label: "Finance", description: "Tutor payouts, student billing, and internal finances.", path: "/dashboard/owner/finance", icon: Wallet },
  { label: "Billing & Plan", description: "Subscription, credits, and storage.", path: "/dashboard/owner/billing", icon: CreditCard },
  { label: "Settings", description: "Profile, password, and Google Calendar.", path: "/dashboard/settings", icon: Settings },
];

function DashboardFeaturesSection() {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full">
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <CollapsibleTrigger className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors">
          <h2 className="text-lg font-semibold">Dashboard features</h2>
          <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4 pt-0">
            {dashboardFeatures.map((f) => (
              <Link
                key={f.path}
                href={f.path}
                className="block p-3 rounded-xl bg-secondary/30 border border-border hover:bg-secondary/50 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <f.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium">{f.label}</span>
                </div>
                <p className="text-sm text-muted-foreground">{f.description}</p>
              </Link>
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

const AdminDashboard = () => {
  useAuth();
  const { stats, tutors, assignedStudents, isLoading } = useOwnerWorkspace();

  const statsCards = [
    { icon: Users, label: "Tutors", value: stats.tutorsCount, path: "/dashboard/owner/tutors", iconClass: "feature-icon-indigo" },
    { icon: GraduationCap, label: "Students", value: stats.studentsCount, path: "/dashboard/owner/students", iconClass: "feature-icon-teal" },
    { icon: Building, label: "Classrooms", value: stats.classroomsCount, path: "/dashboard/owner/classrooms", iconClass: "feature-icon-purple" },
  ];

  const recentTutors = tutors.slice(0, 4);
  const recentStudents = assignedStudents.slice(0, 4);

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
                        <Link key={s.student_id} href={`/dashboard/owner/students/${s.student_id}`} className="block p-3 rounded-xl bg-secondary/30 border border-border hover:bg-secondary/50">
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

          {/* Quick links */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-muted-foreground" />
              Quick links
            </h2>
            <div className="space-y-3">
              <Link href="/dashboard/owner/workspace" className="block p-3 rounded-xl bg-secondary/30 border border-border hover:bg-secondary/50 font-medium">
                Workspace settings
              </Link>
              <Link href="/dashboard/owner/billing" className="block p-3 rounded-xl bg-secondary/30 border border-border hover:bg-secondary/50 font-medium">
                Billing & Plan
              </Link>
              <Link href="/dashboard/settings" className="block w-full p-3 rounded-xl bg-secondary hover:bg-secondary/80 border border-border font-medium transition-colors text-center">
                <div className="flex items-center justify-center gap-2">
                  <Settings className="w-5 h-5" />
                  Settings
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Dashboard features */}
        <DashboardFeaturesSection />
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
