import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import {
  BookOpen,
  Target,
  Trophy,
  Clock,
  Brain,
  TrendingUp,
  Lightbulb,
} from "lucide-react";

const StudentDashboard = () => {
  const { user } = useAuth();

  const stats = [
    {
      icon: BookOpen,
      label: "Courses Enrolled",
      value: "6",
      change: "2 in progress",
      iconClass: "feature-icon-indigo",
    },
    {
      icon: Target,
      label: "Assignments Due",
      value: "3",
      change: "Next: Tomorrow",
      iconClass: "feature-icon-rose",
    },
    {
      icon: Trophy,
      label: "Completed",
      value: "24",
      change: "+5 this week",
      iconClass: "feature-icon-amber",
    },
    {
      icon: TrendingUp,
      label: "Overall Progress",
      value: "78%",
      change: "+8% this month",
      iconClass: "feature-icon-teal",
    },
  ];

  const upcomingAssignments = [
    { title: "Calculus Quiz #4", course: "Mathematics", due: "Tomorrow", urgent: true },
    { title: "Physics Lab Report", course: "Physics", due: "In 3 days", urgent: false },
    { title: "Essay Submission", course: "English", due: "In 5 days", urgent: false },
  ];

  const studyRecommendations = [
    { topic: "Integration Techniques", reason: "Based on quiz performance", progress: 45 },
    { topic: "Newton's Laws", reason: "Upcoming test topic", progress: 72 },
    { topic: "Organic Chemistry", reason: "Weak area detected", progress: 30 },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">
            Hello, {user?.email?.split("@")[0]}!
          </h1>
          <p className="text-muted-foreground mt-1">
            Keep up the great work! Here's your learning progress.
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
              </div>
              <div className="text-3xl font-bold mb-1">{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
              <div className="text-xs text-accent mt-2">{stat.change}</div>
            </div>
          ))}
        </div>

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Upcoming Assignments */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-muted-foreground" />
              Upcoming Assignments
            </h2>
            <div className="space-y-4">
              {upcomingAssignments.map((assignment, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-xl border ${
                    assignment.urgent
                      ? "border-edu-rose/30 bg-edu-rose-light/30"
                      : "border-border bg-secondary/30"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{assignment.title}</p>
                      <p className="text-sm text-muted-foreground">{assignment.course}</p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        assignment.urgent
                          ? "bg-edu-rose/10 text-edu-rose font-medium"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {assignment.due}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Study Recommendations */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-edu-amber" />
              AI Study Recommendations
            </h2>
            <div className="space-y-4">
              {studyRecommendations.map((rec, index) => (
                <div key={index} className="p-4 rounded-xl bg-secondary/30 border border-border">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-medium">{rec.topic}</p>
                      <p className="text-xs text-muted-foreground">{rec.reason}</p>
                    </div>
                    <span className="text-sm font-medium">{rec.progress}%</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        rec.progress < 50
                          ? "bg-edu-rose"
                          : rec.progress < 75
                          ? "bg-edu-amber"
                          : "bg-accent"
                      }`}
                      style={{ width: `${rec.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-4 p-3 rounded-xl bg-primary/5 hover:bg-primary/10 border border-primary/20 text-primary font-medium transition-colors">
              <div className="flex items-center justify-center gap-2">
                <Brain className="w-5 h-5" />
                Start AI Study Session
              </div>
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentDashboard;
