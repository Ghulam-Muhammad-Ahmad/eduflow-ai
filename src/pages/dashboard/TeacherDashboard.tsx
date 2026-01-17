import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import {
  FileText,
  ClipboardCheck,
  Brain,
  Calendar,
  Users,
  TrendingUp,
  Clock,
} from "lucide-react";

const TeacherDashboard = () => {
  const { user } = useAuth();

  const stats = [
    {
      icon: FileText,
      label: "Documents",
      value: "24",
      change: "+3 this week",
      iconClass: "feature-icon-indigo",
    },
    {
      icon: ClipboardCheck,
      label: "Active Quizzes",
      value: "8",
      change: "2 pending review",
      iconClass: "feature-icon-teal",
    },
    {
      icon: Users,
      label: "Students",
      value: "156",
      change: "+12 this month",
      iconClass: "feature-icon-purple",
    },
    {
      icon: Brain,
      label: "AI Tasks",
      value: "47",
      change: "Completed today",
      iconClass: "feature-icon-amber",
    },
  ];

  const recentActivity = [
    { action: "Graded assignment", subject: "Calculus Quiz #3", time: "2 min ago" },
    { action: "Created lesson plan", subject: "Advanced Algebra", time: "1 hour ago" },
    { action: "Uploaded document", subject: "Physics Notes Ch. 5", time: "3 hours ago" },
    { action: "Generated quiz", subject: "Chemistry Mid-term", time: "Yesterday" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">
            Welcome back, {user?.email?.split("@")[0]}!
          </h1>
          <p className="text-muted-foreground mt-1">
            Here's what's happening with your classes today.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-card rounded-2xl border border-border p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={stat.iconClass}>
                  <stat.icon className="w-6 h-6" />
                </div>
                <TrendingUp className="w-4 h-4 text-accent" />
              </div>
              <div className="text-3xl font-bold mb-1">{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
              <div className="text-xs text-accent mt-2">{stat.change}</div>
            </div>
          ))}
        </div>

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recent Activity */}
          <div className="lg:col-span-2 bg-card rounded-2xl border border-border p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-muted-foreground" />
              Recent Activity
            </h2>
            <div className="space-y-4">
              {recentActivity.map((activity, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-3 border-b border-border last:border-0"
                >
                  <div>
                    <p className="font-medium">{activity.action}</p>
                    <p className="text-sm text-muted-foreground">{activity.subject}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {activity.time}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <button className="w-full p-4 rounded-xl bg-primary/5 hover:bg-primary/10 border border-primary/20 text-left transition-colors">
                <div className="flex items-center gap-3">
                  <div className="feature-icon-indigo">
                    <Brain className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium">Generate Lesson Plan</p>
                    <p className="text-xs text-muted-foreground">AI-powered planning</p>
                  </div>
                </div>
              </button>
              <button className="w-full p-4 rounded-xl bg-accent/5 hover:bg-accent/10 border border-accent/20 text-left transition-colors">
                <div className="flex items-center gap-3">
                  <div className="feature-icon-teal">
                    <ClipboardCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium">Create Quiz</p>
                    <p className="text-xs text-muted-foreground">From your materials</p>
                  </div>
                </div>
              </button>
              <button className="w-full p-4 rounded-xl bg-secondary hover:bg-secondary/80 border border-border text-left transition-colors">
                <div className="flex items-center gap-3">
                  <div className="feature-icon-purple">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium">View Schedule</p>
                    <p className="text-xs text-muted-foreground">Upcoming classes</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TeacherDashboard;
