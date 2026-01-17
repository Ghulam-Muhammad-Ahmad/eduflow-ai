import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  GraduationCap,
  LayoutDashboard,
  FileText,
  ClipboardCheck,
  Brain,
  Calendar,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const roleConfig = {
  teacher: {
    title: "Teacher Dashboard",
    navItems: [
      { icon: LayoutDashboard, label: "Overview", path: "/dashboard/teacher" },
      { icon: FileText, label: "Documents", path: "/dashboard/teacher/documents" },
      { icon: ClipboardCheck, label: "Quizzes", path: "/dashboard/teacher/quizzes" },
      { icon: Brain, label: "AI Grading", path: "/dashboard/teacher/grading" },
      { icon: Calendar, label: "Lesson Plans", path: "/dashboard/teacher/lessons" },
      { icon: Users, label: "Students", path: "/dashboard/teacher/students" },
    ],
  },
  student: {
    title: "Student Dashboard",
    navItems: [
      { icon: LayoutDashboard, label: "Overview", path: "/dashboard/student" },
      { icon: Brain, label: "Study Hub", path: "/dashboard/student/study" },
      { icon: ClipboardCheck, label: "Assignments", path: "/dashboard/student/assignments" },
      { icon: Calendar, label: "Progress", path: "/dashboard/student/progress" },
    ],
  },
  admin: {
    title: "Admin Dashboard",
    navItems: [
      { icon: LayoutDashboard, label: "Overview", path: "/dashboard/admin" },
      { icon: Users, label: "Users", path: "/dashboard/admin/users" },
      { icon: Settings, label: "Settings", path: "/dashboard/admin/settings" },
    ],
  },
};

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const config = role ? roleConfig[role] : null;

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b border-border flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-edu-purple flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-semibold">{config.title}</span>
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 hover:bg-secondary rounded-lg"
        >
          {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-card border-r border-border z-40 transform transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-border hidden lg:block">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-edu-purple flex items-center justify-center shadow-md group-hover:shadow-glow transition-shadow">
                <GraduationCap className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg">
                Edu<span className="gradient-text">LabLoom</span>
              </span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 pt-20 lg:pt-4 overflow-y-auto">
            <div className="space-y-1">
              {config.navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                    {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* User Section */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-3 px-4 py-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-edu-purple flex items-center justify-center text-primary-foreground font-semibold">
                {user?.email?.[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{user?.email}</p>
                <p className="text-xs text-muted-foreground capitalize">{role}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
              onClick={handleSignOut}
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
};

export default DashboardLayout;
