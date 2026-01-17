import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import {
  Users,
  GraduationCap,
  Building,
  Activity,
  TrendingUp,
  Shield,
  Settings,
} from "lucide-react";

const AdminDashboard = () => {
  const { user } = useAuth();

  const stats = [
    {
      icon: Users,
      label: "Total Users",
      value: "1,234",
      change: "+48 this week",
      iconClass: "feature-icon-indigo",
    },
    {
      icon: GraduationCap,
      label: "Active Teachers",
      value: "89",
      change: "+5 this month",
      iconClass: "feature-icon-teal",
    },
    {
      icon: Building,
      label: "Departments",
      value: "12",
      change: "All active",
      iconClass: "feature-icon-purple",
    },
    {
      icon: Activity,
      label: "System Health",
      value: "99.9%",
      change: "Uptime",
      iconClass: "feature-icon-amber",
    },
  ];

  const recentUsers = [
    { name: "John Doe", email: "john@school.edu", role: "Teacher", joined: "Today" },
    { name: "Jane Smith", email: "jane@school.edu", role: "Student", joined: "Today" },
    { name: "Mike Wilson", email: "mike@school.edu", role: "Teacher", joined: "Yesterday" },
    { name: "Sarah Brown", email: "sarah@school.edu", role: "Student", joined: "Yesterday" },
  ];

  const systemAlerts = [
    { type: "info", message: "System update scheduled for midnight", time: "2 hours ago" },
    { type: "success", message: "Backup completed successfully", time: "6 hours ago" },
    { type: "warning", message: "High API usage detected", time: "1 day ago" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Manage your institution's EduLabLoom deployment.
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-medium">
            <Shield className="w-4 h-4" />
            Admin Access
          </div>
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
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Recent Users */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-muted-foreground" />
              Recent Users
            </h2>
            <div className="space-y-3">
              {recentUsers.map((user, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-edu-purple flex items-center justify-center text-primary-foreground font-semibold text-sm">
                      {user.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        user.role === "Teacher"
                          ? "bg-edu-teal-light text-edu-teal"
                          : "bg-edu-purple-light text-edu-purple"
                      }`}
                    >
                      {user.role}
                    </span>
                    <p className="text-xs text-muted-foreground mt-1">{user.joined}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* System Alerts */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-muted-foreground" />
              System Alerts
            </h2>
            <div className="space-y-3">
              {systemAlerts.map((alert, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-xl border ${
                    alert.type === "warning"
                      ? "border-edu-amber/30 bg-edu-amber-light/30"
                      : alert.type === "success"
                      ? "border-accent/30 bg-edu-teal-light/30"
                      : "border-primary/30 bg-primary/5"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <p className="text-sm font-medium">{alert.message}</p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                      {alert.time}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-4 p-3 rounded-xl bg-secondary hover:bg-secondary/80 border border-border font-medium transition-colors">
              <div className="flex items-center justify-center gap-2">
                <Settings className="w-5 h-5" />
                System Settings
              </div>
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
