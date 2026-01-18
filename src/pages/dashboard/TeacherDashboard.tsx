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
} from "lucide-react";

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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                  <stat.icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <span className={`text-xs font-medium ${stat.badgeColor}`}>
                  {stat.badge}
                </span>
              </div>
              <div className="text-2xl font-bold mb-1">{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Document Management - Takes 2 columns */}
          <div className="lg:col-span-2 bg-card rounded-xl border border-border p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">Document Management</h2>
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                Upload Document
              </Button>
            </div>

            {/* Search and Filter */}
            <div className="flex gap-3 mb-5">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents..."
                  className="pl-10"
                />
              </div>
              <Button variant="outline" size="icon">
                <Filter className="w-4 h-4" />
              </Button>
            </div>

            {/* Document List */}
            <div className="space-y-3">
              {documents.map((doc, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-secondary/30 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-lg">
                    {doc.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-primary truncate">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">{doc.updated} • {doc.size}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                      <Share2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-3">
              {quickActions.map((action, index) => (
                <button
                  key={index}
                  className="w-full flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-secondary/50 transition-colors text-left"
                >
                  <action.icon className={`w-5 h-5 ${action.color}`} />
                  <span className="font-medium">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recent Assignments */}
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Recent Assignments</h2>
              <Button variant="link" className="text-muted-foreground p-0 h-auto">
                View all
              </Button>
            </div>
            <div className="space-y-4">
              {assignments.map((assignment, index) => (
                <div key={index} className="pb-4 border-b border-border last:border-0 last:pb-0">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-primary">{assignment.title}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full ${assignment.statusColor}`}>
                      {assignment.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{assignment.due}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {assignment.students} students
                    </span>
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {assignment.submitted} submitted
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Quizzes */}
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Active Quizzes</h2>
              <Button variant="link" className="text-muted-foreground p-0 h-auto">
                View all
              </Button>
            </div>
            <div className="space-y-4">
              {quizzes.map((quiz, index) => (
                <div key={index} className="pb-4 border-b border-border last:border-0 last:pb-0">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-primary">{quiz.title}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full ${quiz.statusColor}`}>
                      {quiz.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{quiz.due}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <HelpCircle className="w-3 h-3" />
                      {quiz.questions} questions
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

          {/* AI Grading Status */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold mb-4">AI Grading Status</h2>
            <div className="space-y-5">
              {gradingStatus.map((item, index) => (
                <div key={index}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-primary font-medium">{item.title}</span>
                    <span className="text-sm text-muted-foreground">
                      {item.completed}/{item.total}
                    </span>
                  </div>
                  <Progress value={item.progress} className="h-2" />
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