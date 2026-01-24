import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Bell,
  HelpCircle,
  BarChart3,
} from "lucide-react";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const roleConfig = {
  teacher: {
    title: "Teacher Dashboard",
    navItems: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard/teacher" },
      { icon: Users, label: "Classrooms", path: "/dashboard/teacher/classrooms" },
      { icon: FileText, label: "Documents", path: "/dashboard/teacher/documents" },
      { icon: ClipboardCheck, label: "Assignments", path: "/dashboard/teacher/assignments" },
      { icon: HelpCircle, label: "Quizzes", path: "/dashboard/teacher/quizzes" },
      { icon: Brain, label: "AI Grading", path: "/dashboard/teacher/grading" },
      { icon: Calendar, label: "Lesson Planner", path: "/dashboard/teacher/lessons" },
      { icon: BarChart3, label: "Analytics", path: "/dashboard/teacher/analytics" },
    ],
  },
  student: {
    title: "Student Dashboard",
    navItems: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard/student" },
      { icon: Users, label: "My Classes", path: "/dashboard/student/classrooms" },
      { icon: Brain, label: "Study Hub", path: "/dashboard/student/study" },
      { icon: ClipboardCheck, label: "Assignments", path: "/dashboard/student/assignments" },
      { icon: BarChart3, label: "Progress", path: "/dashboard/student/progress" },
    ],
  },
  admin: {
    title: "Admin Dashboard",
    navItems: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard/admin" },
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const displayName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "User";

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`fixed lg:static top-0 left-0 h-screen w-64 bg-card border-r border-border z-40 transform transition-transform duration-200 lg:translate-x-0 flex flex-col ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-border">
          <Link to="/" className="flex flex-col group">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg tracking-tight text-foreground">
                EduLabLoom
              </span>
            </div>
            <span className="text-xs text-primary font-medium mt-1">
              Learning Management
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-1">
            {config.navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    isActive
                      ? "bg-primary/10 text-primary font-medium border border-primary/20"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <item.icon className={`w-5 h-5 ${isActive ? "text-primary" : ""}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 px-2 py-3 mb-2">
            <Avatar className="h-10 w-10 border-2 border-primary/20">
              <AvatarImage src="" />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {displayName[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate text-foreground">{displayName}</p>
              <p className="text-xs text-muted-foreground capitalize">{role}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-ink-black/50 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-secondary rounded-lg lg:hidden transition-colors"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <h1 className="text-xl font-semibold text-foreground">{config.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
              <Bell className="w-5 h-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-muted-foreground hover:text-primary"
              onClick={() => navigate("/dashboard/settings")}
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-auto bg-secondary/30">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
