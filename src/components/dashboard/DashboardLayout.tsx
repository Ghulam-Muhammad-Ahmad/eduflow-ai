import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { useAuth } from "@/hooks/useAuth";
import { useAIUsage } from "@/hooks/useAIUsage";
import { useStudentHasContent } from "@/hooks/useHasClassrooms";
import { useStudentNavVisibility } from "@/hooks/useStudentNavVisibility";
import { STUDENT_NAV_ITEMS } from "@/lib/studentNav";
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
  LayoutDashboard,
  FileText,
  ClipboardCheck,
  Calendar,
  Users,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Bell,
  Sparkles,
  BookOpen,
  School,
  ListChecks,
  GraduationCap,
  ScrollText,
  CreditCard,
  Search,
  PenLine,
  User,
  UserRound,
  Building2,
  Video,
  ChevronsUpDownIcon,
  Wallet,
  Brain,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DashboardOnboardingChecklist } from "@/components/dashboard/DashboardOnboardingChecklist";

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
      { icon: UserRound, label: "1v1 Rooms", path: "/dashboard/teacher/rooms" },
      { icon: FileText, label: "Documents", path: "/dashboard/teacher/documents" },
      { icon: PenLine, label: "Contract", path: "/dashboard/teacher/contract" },
      { icon: Wallet, label: "Earnings", path: "/dashboard/teacher/earnings" },
      { icon: User, label: "My profile", path: "/dashboard/teacher/profile" },
      { icon: ClipboardCheck, label: "My Evaluation", path: "/dashboard/teacher/evaluation" },
      { icon: Sparkles, label: "AI Content Generator", path: "/dashboard/teacher/ai-studio" },
      { icon: ClipboardCheck, label: "Assignments", path: "/dashboard/teacher/assignments" },
      { icon: ListChecks, label: "Quizzes", path: "/dashboard/teacher/quizzes" },
      { icon: ScrollText, label: "Student Records", path: "/dashboard/teacher/student-records" },
      { icon: BookOpen, label: "Lesson Planner", path: "/dashboard/teacher/lesson-planner" },
      { icon: Calendar, label: "Calendar", path: "/dashboard/teacher/calendar" },
      { icon: Video, label: "Sessions", path: "/dashboard/teacher/sessions" },
      { icon: Settings, label: "Settings", path: "/dashboard/settings" },
    ],
  },
  student: {
    title: "Student Dashboard",
    navItems: STUDENT_NAV_ITEMS,
  },
  admin: {
    title: "Owner Dashboard",
    navItems: [
      { icon: LayoutDashboard, label: "Overview", path: "/dashboard/owner" },
      { icon: Users, label: "Tutors", path: "/dashboard/owner/tutors" },
      { icon: Brain, label: "Evaluations", path: "/dashboard/owner/evaluations" },
      { icon: PenLine, label: "Contracts", path: "/dashboard/owner/contracts" },
      { icon: GraduationCap, label: "Students", path: "/dashboard/owner/students" },
      { icon: Sparkles, label: "Tutor Matching", path: "/dashboard/owner/tutor-matching" },
      { icon: School, label: "Classes", path: "/dashboard/owner/classrooms" },
      { icon: UserRound, label: "1v1 Rooms", path: "/dashboard/owner/rooms" },
      { icon: ScrollText, label: "Student Records", path: "/dashboard/owner/student-records" },
      { icon: Video, label: "Sessions", path: "/dashboard/owner/sessions" },
      { icon: FileText, label: "Documents", path: "/dashboard/owner/documents" },
      { icon: ClipboardCheck, label: "Assignments", path: "/dashboard/owner/assignments" },
      { icon: ListChecks, label: "Quizzes", path: "/dashboard/owner/quizzes" },
      { icon: Building2, label: "Workspace", path: "/dashboard/owner/workspace" },
      { icon: Wallet, label: "Finance", path: "/dashboard/owner/finance" },
      { icon: CreditCard, label: "Billing & Plan", path: "/dashboard/owner/billing" },
      { icon: Settings, label: "Settings", path: "/dashboard/settings" },
    ],
  },
};

const DashboardLayout = ({ children, role: _role }: DashboardLayoutProps) => {
  const { user, role, profile, signOut } = useAuth();
  const { usage, loading: usageLoading } = useAIUsage();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ⌘F / Ctrl+F to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 0);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const config =
    role && role in roleConfig ? roleConfig[role as keyof typeof roleConfig] : null;

  // Students only: hide the whole sidebar when they have no classroom/1v1 room yet, and
  // otherwise apply the workspace/per-student nav visibility settings. "dashboard" is
  // always kept so a student with everything hidden still has one reachable page.
  const { hasContent, isLoading: hasContentLoading } = useStudentHasContent();
  const { hiddenKeys } = useStudentNavVisibility();
  const navItems = useMemo(() => {
    if (!config) return [];
    if (role !== "student") return config.navItems;
    if (!hasContentLoading && !hasContent) return [];
    return STUDENT_NAV_ITEMS.filter((item) => item.key === "dashboard" || !hiddenKeys.has(item.key));
  }, [config, role, hasContent, hasContentLoading, hiddenKeys]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  // Get current page title based on route
  const getPageTitle = () => {
    if (!config) return "";

    // Find the matching nav item for current route
    const currentNavItem = navItems.find(
      (item) => router.pathname === item.path || router.asPath === item.path
    );
    
    if (currentNavItem) {
      return currentNavItem.label;
    }
    
    // Check for nested routes
    const nestedNavItem = navItems.find(
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
        <Spinner size="lg" />
      </div>
    );
  }

  const displayName = profile?.display_name || user?.user_metadata?.display_name || user?.email?.split("@")[0] || "User";
  const avatarUrl = profile?.avatar_url || "";
  const roleLabel = role === "teacher" ? "Tutor" : role === "student" ? "Student" : role === "admin" ? "Owner" : role ?? "User";
  const userEmail = user?.email ?? "";

  return (
    <>
      <Head>
        <title>{getPageTitle()} | EduLabLoom</title>
      </Head>
      <div className="h-screen flex bg-background overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 border-r border-border h-screen w-64 bg-[#fafafa] z-40 transform transition-transform duration-200 flex flex-col p-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo + close sidebar */}
        <div className="pt-2.5 pr-2.5 pb-2.5 pl-2.5 h-[65px] border-b border-border">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex flex-col group">
              <div className="flex items-center gap-[5px]">
                <div className="w-6 h-6 flex items-center justify-center">
                  <Image 
                    src="/mainlogo.svg" 
                    alt="EduLabLoom Logo" 
                    width={25} 
                    height={25}
                    className="w-6 h-6"
                  />
                </div>
                <span className="font-semibold text-[22px] tracking-tight text-foreground">
                  EduLabLoom
                </span>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="p-2 -mr-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Close sidebar"
            >
              <PanelLeftClose className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav-scroll flex-1 pl-2.5 pr-2.5 pt-0 pb-0 mt-2.5 mb-2.5 overflow-y-auto">
          <div className="space-y-0.5">
            {navItems.map((item) => {
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
                  onClick={() => {
                    // Only close sidebar on mobile so it doesn't flick on laptop
                    if (typeof window !== "undefined" && window.innerWidth < 1024) {
                      setSidebarOpen(false);
                    }
                  }}
                  className={`flex items-center gap-3 px-2.5 py-2.5 rounded-lg transition-all duration-200 ${
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
        <div className="px-2.5 pb-2.5 border-t border-border mt-2.5">
          {!usageLoading && usage && (
            <div className="px-3 py-3 bg-card rounded-xl border border-border shadow-sm mt-2.5">
              <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground mb-0.5">
                AI Credits
              </h3>
              <p className="text-sm text-muted-foreground mb-2">
                {usage.currentCredits} / {usage.limitCredits} credits
              </p>
              </div>
              {/* Segment-style progress: bars show credits used (0 used = empty, full = all used) */}
              <div className="flex gap-0.5 mb-3" aria-hidden>
                {Array.from({ length: 25 }).map((_, i) => {
                  const usedRatio = usage.limitCredits > 0 ? usage.currentCredits / usage.limitCredits : 0;
                  const segmentThreshold = (i + 1) / 25;
                  const filled = usedRatio >= segmentThreshold;
                  const segmentColor =
                    usage.percentage >= 90
                      ? "bg-red-500"
                      : usage.percentage >= 70
                        ? "bg-amber-500"
                        : "bg-primary";
                  return (
                    <div
                      key={i}
                      className={`flex-1 min-w-[4px] rounded-sm transition-colors ${
                        filled ? segmentColor : "bg-muted"
                      }`}
                      style={{ height: 20 }}
                    />
                  );
                })}
              </div>
             
              <Link
                href={
                  role === "teacher"
                    ? "/dashboard/teacher/billing"
                    : role === "student"
                      ? "/dashboard/student/billing"
                      : "/dashboard/owner/billing"
                }
                className="block w-full text-center text-xs font-medium py-2 px-3 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors"
              >
                View billing
              </Link>
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
      <div className={`flex-1 flex flex-col min-h-screen transition-[margin] duration-200 ${sidebarOpen ? "lg:ml-64" : ""}`}>
        {/* Top Header */}
        <header className="h-[65px] bg-[#fafafa] border-b flex items-center justify-between px-6 sticky top-0 z-20">
          <div className="flex items-center gap-4 flex-1 min-w-0 max-w-[300px]">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 hover:bg-secondary rounded-lg transition-colors shrink-0"
                aria-label="Open sidebar"
              >
                <PanelLeftOpen className="w-5 h-5" />
              </button>
            )}
            <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
              <button
                type="button"
                className="flex items-center gap-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-sm transition-colors text-left focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 hover:bg-muted/50"
                onClick={() => {
                  setSearchOpen(true);
                  setTimeout(() => searchInputRef.current?.focus(), 0);
                }}
              >
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-muted-foreground">
                  {searchQuery || "Search task"}
                </span>
<kbd className="pointer-events-none hidden sm:inline-flex h-6 select-none items-center justify-center rounded border border-border/80 bg-muted/80 px-2 font-mono text-xs font-medium text-muted-foreground">
                    ⌘
                  </kbd>
              </button>
              <DialogContent
                className="max-w-md p-0 gap-0 overflow-hidden"
                onOpenAutoFocus={(e) => {
                  e.preventDefault();
                  searchInputRef.current?.focus();
                }}
              >
                <DialogTitle className="sr-only">Search and navigate</DialogTitle>
                <DialogDescription className="sr-only">
                  Search dashboard pages and navigate to them
                </DialogDescription>
                <div className="relative flex items-center gap-3 border-b border-border focus-visible:ring-0 bg-muted/30 px-4 py-3">
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search task"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-10 flex-1 border-0 bg-transparent pl-0 pr-10 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none shadow-none"
                  />
                  <kbd className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:inline-flex h-6 select-none items-center justify-center rounded border border-border/80 bg-background/95 px-2 font-mono text-xs font-medium text-muted-foreground shadow-sm">
                    ⌘
                  </kbd>
                </div>
                <div className="max-h-[50vh] overflow-y-auto py-2">
                  {navItems
                    .filter((item) =>
                      item.label.toLowerCase().includes(searchQuery.trim().toLowerCase())
                    )
                    .map((item) => (
                      <button
                        key={item.path}
                        type="button"
                        className="flex w-full items-center gap-3 rounded-none px-4 py-2.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                        onClick={() => {
                          router.push(item.path);
                          setSearchQuery("");
                          setSearchOpen(false);
                        }}
                      >
                        <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        {item.label}
                      </button>
                    ))}
                  {navItems.filter((item) =>
                    item.label.toLowerCase().includes(searchQuery.trim().toLowerCase())
                  ).length === 0 && (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      No matches
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="gap-2 px-1.5 py-2.5 hover:bg-secondary min-w-48 max-w-auto flex items-center justify-between focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none focus:ring-0"
              >
                <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8 border-2 border-primary/20 shrink-0">
                  <AvatarImage src={avatarUrl} />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                    {displayName[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start text-left min-w-0 max-w-[160px] gap-0.5">
                  <span className="text-sm leading-none font-medium text-foreground truncate w-full">
                    {roleLabel}
                  </span>
                  <span className="text-xs text-muted-foreground truncate w-full" title={userEmail}>
                    {userEmail || "—"}
                  </span>
                </div>
                </div>
                <ChevronsUpDownIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 [&:focus]:ring-0 [&:focus-visible]:ring-0">
              <DropdownMenuItem onClick={() => router.push("/dashboard/settings")} className="focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 [&:focus]:ring-0 [&:focus-visible]:ring-0">
                <Bell className="w-4 h-4 mr-2" />
                Notifications
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/dashboard/settings")} className="focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 [&:focus]:ring-0 [&:focus-visible]:ring-0">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleSignOut}
                className="text-destructive focus:text-destructive focus:bg-destructive/10 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 [&:focus]:ring-0 [&:focus-visible]:ring-0"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-auto bg-white min-w-0">
          {children}
        </main>

        <DashboardOnboardingChecklist />
      </div>
    </div>
    </>
  );
};

export default DashboardLayout;
