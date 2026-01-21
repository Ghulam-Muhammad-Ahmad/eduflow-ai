import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  FileText,
  ClipboardCheck,
  Brain,
  Calendar,
  Users,
  Search,
  Filter,
  Plus,
  Share2,
  MoreVertical,
  HelpCircle,
  Clock,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

const TeacherDashboard = () => {
  const stats = [
    {
      icon: FileText,
      label: "Total Documents",
      value: "248",
      badge: "+12%",
      badgeColor: "text-primary",
    },
    {
      icon: ClipboardCheck,
      label: "Pending Assignments",
      value: "34",
      badge: "Active",
      badgeColor: "text-muted-foreground",
    },
    {
      icon: Brain,
      label: "Papers Graded",
      value: "127",
      badge: "AI",
      badgeColor: "text-muted-foreground",
    },
    {
      icon: Users,
      label: "Students Enrolled",
      value: "342",
      badge: "Total",
      badgeColor: "text-muted-foreground",
    },
  ];

  const documents = [
    { name: "Chemistry Chapter 5.pdf", updated: "Updated 2 hours ago", size: "2.4 MB", icon: "📕" },
    { name: "Biology Assignment Template.docx", updated: "Updated yesterday", size: "1.8 MB", icon: "📄" },
    { name: "Physics Lecture Slides.pptx", updated: "Updated 3 days ago", size: "5.2 MB", icon: "📊" },
  ];

  const quickActions = [
    { icon: ClipboardCheck, label: "Create Assignment", color: "text-foreground" },
    { icon: HelpCircle, label: "Create Quiz", color: "text-foreground" },
    { icon: Calendar, label: "Plan Lesson", color: "text-foreground" },
    { icon: Brain, label: "AI Grade Papers", color: "text-foreground" },
  ];

  const assignments = [
    { title: "Cell Structure Essay", due: "Due: March 15, 2025", students: 42, submitted: 28, status: "Pending", statusColor: "text-amber-600 bg-amber-50" },
    { title: "Chemical Reactions Lab Report", due: "Due: March 20, 2025", students: 38, submitted: 15, status: "Active", statusColor: "text-primary bg-primary/10" },
    { title: "Physics Problem Set #3", due: "Due: March 25, 2025", students: 45, submitted: 8, status: "Active", statusColor: "text-primary bg-primary/10" },
  ];

  const quizzes = [
    { title: "Periodic Table Quiz", due: "Due: March 12, 2025", questions: 15, duration: "30 min", status: "Live", statusColor: "text-accent bg-accent/10" },
    { title: "DNA & Genetics Quiz", due: "Due: March 18, 2025", questions: 20, duration: "45 min", status: "Scheduled", statusColor: "text-muted-foreground bg-secondary" },
    { title: "Newton's Laws Assessment", due: "Due: March 22, 2025", questions: 12, duration: "25 min", status: "Draft", statusColor: "text-amber-600 bg-amber-50" },
  ];

  const gradingStatus = [
    { title: "Chemistry Exam", progress: 80, completed: 24, total: 30 },
    { title: "Biology Quiz", progress: 72, completed: 18, total: 25 },
    { title: "Physics Assignment", progress: 60, completed: 12, total: 20 },
  ];

  const weeklyActivityData = [
    { day: "Mon", submissions: 24, graded: 18 },
    { day: "Tue", submissions: 32, graded: 28 },
    { day: "Wed", submissions: 18, graded: 22 },
    { day: "Thu", submissions: 45, graded: 35 },
    { day: "Fri", submissions: 38, graded: 42 },
    { day: "Sat", submissions: 12, graded: 15 },
    { day: "Sun", submissions: 8, graded: 10 },
  ];

  const studentEngagementData = [
    { month: "Jan", engagement: 65 },
    { month: "Feb", engagement: 72 },
    { month: "Mar", engagement: 85 },
    { month: "Apr", engagement: 78 },
    { month: "May", engagement: 92 },
    { month: "Jun", engagement: 88 },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-card rounded-lg border border-border p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
                  <stat.icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xl font-bold">{stat.value}</div>
                  <div className="text-xs text-muted-foreground truncate">{stat.label}</div>
                </div>
                <span className={`text-xs font-medium ${stat.badgeColor}`}>
                  {stat.badge}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions - Full width, single row */}
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {quickActions.map((action, index) => (
              <button
                key={index}
                className="flex items-center justify-center gap-2 p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors"
              >
                <action.icon className={`w-4 h-4 ${action.color}`} />
                <span className="text-sm font-medium">{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid lg:grid-cols-2 gap-3">
          {/* Weekly Activity Chart */}
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Weekly Activity</h2>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  Submissions
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-accent" />
                  Graded
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={weeklyActivityData}>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} width={30} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }} 
                />
                <Bar dataKey="submissions" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="graded" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Student Engagement Chart */}
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Student Engagement</h2>
              <span className="flex items-center gap-1 text-xs text-primary">
                <TrendingUp className="w-3 h-3" />
                +12% this month
              </span>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={studentEngagementData}>
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} width={30} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }} 
                />
                <defs>
                  <linearGradient id="engagementGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area 
                  type="monotone" 
                  dataKey="engagement" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  fill="url(#engagementGradient)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Main Content Grid - 2 columns */}
        <div className="grid lg:grid-cols-3 gap-3">
          {/* Document Management - Takes 2 columns */}
          <div className="lg:col-span-2 bg-card rounded-lg border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Document Management</h2>
              <Button size="sm" className="gap-1.5 h-8 text-xs">
                <Plus className="w-3.5 h-3.5" />
                Upload
              </Button>
            </div>

            {/* Search and Filter */}
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search documents..."
                  className="pl-8 h-8 text-sm"
                />
              </div>
              <Button variant="outline" size="icon" className="h-8 w-8">
                <Filter className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* Document List */}
            <div className="space-y-2">
              {documents.map((doc, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-secondary/30 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-sm">
                    {doc.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-primary truncate">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">{doc.updated} • {doc.size}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                      <Share2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                      <MoreVertical className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Grading Status */}
          <div className="bg-card rounded-lg border border-border p-4">
            <h2 className="text-sm font-semibold mb-3">AI Grading Status</h2>
            <div className="space-y-4">
              {gradingStatus.map((item, index) => (
                <div key={index}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-primary font-medium">{item.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.completed}/{item.total}
                    </span>
                  </div>
                  <Progress value={item.progress} className="h-1.5" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Grid - 2 columns */}
        <div className="grid lg:grid-cols-2 gap-3">
          {/* Recent Assignments */}
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Recent Assignments</h2>
              <Button variant="link" className="text-muted-foreground p-0 h-auto text-xs">
                View all
              </Button>
            </div>
            <div className="space-y-3">
              {assignments.map((assignment, index) => (
                <div key={index} className="pb-3 border-b border-border last:border-0 last:pb-0">
                  <div className="flex items-start justify-between mb-1.5">
                    <h3 className="text-sm font-medium text-primary">{assignment.title}</h3>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${assignment.statusColor}`}>
                      {assignment.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1.5">{assignment.due}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {assignment.students}
                    </span>
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {assignment.submitted} done
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Quizzes */}
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Active Quizzes</h2>
              <Button variant="link" className="text-muted-foreground p-0 h-auto text-xs">
                View all
              </Button>
            </div>
            <div className="space-y-3">
              {quizzes.map((quiz, index) => (
                <div key={index} className="pb-3 border-b border-border last:border-0 last:pb-0">
                  <div className="flex items-start justify-between mb-1.5">
                    <h3 className="text-sm font-medium text-primary">{quiz.title}</h3>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${quiz.statusColor}`}>
                      {quiz.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1.5">{quiz.due}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <HelpCircle className="w-3 h-3" />
                      {quiz.questions}Q
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {quiz.duration}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TeacherDashboard;