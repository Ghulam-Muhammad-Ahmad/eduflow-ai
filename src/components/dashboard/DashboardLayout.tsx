import { useState } from "react";
import Link from "next/link";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { useAuth } from "@/hooks/useAuth";
import { useHasClassrooms } from "@/hooks/useHasClassrooms";
import { useAIUsage } from "@/hooks/useAIUsage";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
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
  Sparkles,
  BookOpen,
  Zap,
  School,
  ListChecks,
  GraduationCap,
  ScrollText,
  ChevronDown,
  Library,
  ClipboardList,
  TrendingUp,
  CreditCard,
} from "lucide-react";

interface DashboardLayoutProps {
  children: React.ReactNode;
  role?: string;
}

const roleConfig = {
  teacher: {
    title: "Tutor Dashboard",
    navItems: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard/teacher" },
      { icon: Users, label: "My Students", path: "/dashboard/teacher/students" },
      { icon: School, label: "My Classes", path: "/dashboard/teacher/classrooms" },
      { icon: FileText, label: "Materials", path: "/dashboard/teacher/documents" },
      { icon: Sparkles, label: "AI Content Generator", path: "/dashboard/teacher/ai-studio" },
      { icon: ClipboardCheck, label: "Assignments", path: "/dashboard/teacher/assignments" },
      { icon: ListChecks, label: "Quizzes", path: "/dashboard/teacher/quizzes" },
      { icon: ScrollText, label: "Student Records", path: "/dashboard/teacher/student-records" },
      { icon: Brain, label: "AI Checker", path: "/dashboard/teacher/checker" },
      { icon: BookOpen, label: "Lesson Planner", path: "/dashboard/teacher/lesson-planner" },
      { icon: Calendar, label: "Calendar", path: "/dashboard/teacher/calendar" },
      { icon: CreditCard, label: "Billing & Plan", path: "/dashboard/teacher/billing" },
      { icon: Settings, label: "Settings", path: "/dashboard/settings" },
    ],
  },
  student: {
    title: "Student Dashboard",
    navItems: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard/student" },
      { icon: Users, label: "My Classes", path: "/dashboard/student/classrooms" },
      { icon: FileText, label: "My Documents", path: "/dashboard/student/documents" },
      { icon: BookOpen, label: "Course Materials", path: "/dashboard/student/course-materials" },
      { icon: ClipboardCheck, label: "Assignments", path: "/dashboard/student/assignments" },
      { icon: ListChecks, label: "Quizzes", path: "/dashboard/student/quizzes" },
      { icon: GraduationCap, label: "Study Hub", path: "/dashboard/student/study" },
      { icon: CreditCard, label: "Billing", path: "/dashboard/student/billing" },
    ],
  },
  studentSelfStudy: {
    title: "Self-Study Dashboard",
    navItems: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard/student" },
      { icon: GraduationCap, label: "Study Hub", path: "/dashboard/student/study" },
      { icon: ClipboardList, label: "Practice Tests", path: "/dashboard/student/practice-tests" },
      { icon: Library, label: "My Library", path: "/dashboard/student/library" },
      { icon: TrendingUp, label: "Progress", path: "/dashboard/student/progress" },
      { icon: CreditCard, label: "Billing", path: "/dashboard/student/billing" },
      { icon: Settings, label: "Settings", path: "/dashboard/settings" },
    ],
  },
  admin: {
    title: "Owner Dashboard",
    navItems: [
      { icon: LayoutDashboard, label: "Overview", path: "/dashboard/owner" },
      { icon: Users, label: "Tutors", path: "/dashboard/owner/tutors" },
      { icon: GraduationCap, label: "Students", path: "/dashboard/owner/students" },
      { icon: School, label: "Classes", path: "/dashboard/owner/classrooms" },
      { icon: ClipboardCheck, label: "Assignments", path: "/dashboard/owner/assignments" },
      { icon: ListChecks, label: "Quizzes", path: "/dashboard/owner/quizzes" },
      { icon: FileText, label: "Documents", path: "/dashboard/owner/documents" },
      { icon: CreditCard, label: "Billing & Plan", path: "/dashboard/owner/billing" },
      { icon: Settings, label: "Settings", path: "/dashboard/settings" },
    ],
  },
};

const DashboardLayout = ({ children, role: _role }: DashboardLayoutProps) => {
  const { user, role, profile, signOut } = useAuth();
  const { hasClassrooms, isLoading: enrollmentsLoading } = useHasClassrooms();
  const { usage, loading: usageLoading } = useAIUsage();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Students with no classrooms see Self-Study nav; once they join a class, they see Classroom nav
  const studentConfigKey =
    role === "student" && !enrollmentsLoading && !hasClassrooms ? "studentSelfStudy" : role;
  const config =
    studentConfigKey && studentConfigKey in roleConfig
      ? roleConfig[studentConfigKey as keyof typeof roleConfig]
      : null;

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  // Get current page title based on route
  const getPageTitle = () => {
    if (!config) return "";
    
    // Find the matching nav item for current route
    const currentNavItem = config.navItems.find(
      (item) => router.pathname === item.path || router.asPath === item.path
    );
    
    if (currentNavItem) {
      return currentNavItem.label;
    }
    
    // Check for nested routes
    const nestedNavItem = config.navItems.find(
      (item) => 
        item.path !== '/dashboard/teacher' && 
        item.path !== '/dashboard/student' && 
        item.path !== '/dashboard/owner' &&
        (router.pathname.startsWith(item.path + '/') || router.asPath.startsWith(item.path + '/'))
    );
    
    if (nestedNavItem) {
      return nestedNavItem.label;
    }
    
    // Check for settings page
    if (router.pathname === '/dashboard/settings' || router.asPath === '/dashboard/settings') {
      return "Settings";
    }
    
    // Default to role-based title
    return config.title;
  };

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const displayName = profile?.display_name || user?.user_metadata?.display_name || user?.email?.split("@")[0] || "User";
  const avatarUrl = profile?.avatar_url || "";

  return (
    <>
      <Head>
        <title>{getPageTitle()} | EduLabLoom</title>
      </Head>
      <div className="h-screen flex bg-background overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`fixed lg:static top-0 left-0 h-screen w-64 bg-card border-r border-border z-40 transform transition-transform duration-200 lg:translate-x-0 flex flex-col ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="p-4 border-b border-border">
          <Link href="/" className="flex flex-col group">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 flex items-center justify-center">
                <Image 
                  src="/mainlogo.svg" 
                  alt="EduLabLoom Logo" 
                  width={32} 
                  height={32}
                  className="w-8 h-8"
                />
              </div>
              <span className="font-bold text-lg tracking-tight text-foreground">
                EduLabLoom
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 overflow-y-auto">
          <div className="space-y-0.5">
            {config.navItems.map((item) => {
              // Check for exact match or if current path starts with nav item path (for nested routes)
              const isActive = 
                router.pathname === item.path || 
                router.asPath === item.path ||
                (item.path !== '/dashboard/teacher' && 
                 item.path !== '/dashboard/student' && 
                 item.path !== '/dashboard/owner' &&
                 (router.pathname.startsWith(item.path + '/') || router.asPath.startsWith(item.path + '/')));
              
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  prefetch={false}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    isActive
                      ? "bg-medium-slate-blue/10 text-medium-slate-blue font-medium border border-medium-slate-blue/20 shadow-sm"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <item.icon className={`w-5 h-5 ${isActive ? "text-medium-slate-blue" : ""}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* AI Usage Bar */}
        <div className="p-3 border-t border-border">
          {!usageLoading && usage && (
            <div className="px-2 py-2 bg-secondary/30 rounded-lg">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Zap className={`h-3.5 w-3.5 ${
                    usage.percentage >= 90 ? 'text-red-500' : 
                    usage.percentage >= 70 ? 'text-yellow-500' : 
                    'text-primary'
                  }`} />
                  <span className="text-xs font-medium text-foreground">AI Credits</span>
                </div>
                <span className={`text-xs font-medium ${
                  usage.percentage >= 90 ? 'text-red-500' : 
                  usage.percentage >= 70 ? 'text-yellow-500' : 
                  'text-muted-foreground'
                }`}>
                  {usage.currentCredits}/{usage.limitCredits}
                </span>
              </div>
              <Progress 
                value={usage.percentage} 
                className={`h-1.5 ${
                  usage.percentage >= 90 ? '[&>div]:bg-red-500' : 
                  usage.percentage >= 70 ? '[&>div]:bg-yellow-500' : 
                  ''
                }`}
              />
              <p className={`text-xs mt-1 ${
                usage.percentage >= 90 ? 'text-red-500 font-medium' : 
                usage.percentage >= 70 ? 'text-yellow-600 dark:text-yellow-500' : 
                'text-muted-foreground'
              }`}>
                {usage.remainingCredits} remaining
              </p>
            </div>
          )}
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
            <h1 className="text-xl font-semibold text-foreground">{getPageTitle()}</h1>
          </div>
          <TooltipProvider delayDuration={300}>
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="rounded-full gap-1 pr-1.5 pl-1 h-9 hover:bg-secondary hover:ring-2 hover:ring-primary/20 focus-visible:ring-2 focus-visible:ring-primary/20"
                    >
                      <Avatar className="h-8 w-8 border-2 border-primary/20">
                        <AvatarImage src={avatarUrl} />
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                          {displayName[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Account
                </TooltipContent>
              </Tooltip>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => router.push("/dashboard/settings")}>
                <Bell className="w-4 h-4 mr-2" />
                Notifications
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/dashboard/settings")}>
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleSignOut}
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
            </DropdownMenu>
          </TooltipProvider>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-auto bg-secondary/30 min-w-0">
          {children}
        </main>
      </div>
    </div>
    </>
  );
};

export default DashboardLayout;
