import { useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";
import JoinClassroomDialog from "@/components/student/JoinClassroomDialog";
import { useAuth } from "@/hooks/useAuth";
import { useHasClassrooms } from "@/hooks/useHasClassrooms";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Target,
  Trophy,
  Clock,
  Brain,
  TrendingUp,
  Lightbulb,
  GraduationCap,
  ClipboardList,
  Library,
  UserPlus,
} from "lucide-react";

const StudentDashboard = () => {
  const { user } = useAuth();
  const { hasClassrooms, isLoading: enrollmentsLoading } = useHasClassrooms();
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const isSelfStudy = !enrollmentsLoading && !hasClassrooms;

  const stats = [
    {
      icon: BookOpen,
      label: "Courses Enrolled",
      value: "6",
      change: "2 in progress",
      iconClass: "bg-primary/10 text-primary",
    },
    {
      icon: Target,
      label: "Assignments Due",
      value: "3",
      change: "Next: Tomorrow",
      iconClass: "bg-destructive/10 text-destructive",
    },
    {
      icon: Trophy,
      label: "Completed",
      value: "24",
      change: "+5 this week",
      iconClass: "bg-slime-lime/10 text-brand-lime-dark",
    },
    {
      icon: TrendingUp,
      label: "Overall Progress",
      value: "78%",
      change: "+8% this month",
      iconClass: "bg-primary/10 text-primary",
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

  const displayName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Student";

  const selfStudyChecklistItems = [
    { label: "Try a practice test", done: false, href: "/dashboard/student/practice-tests" },
    { label: "Add something to My Library", done: false, href: "/dashboard/student/library" },
    { label: "Join a class with a code", done: hasClassrooms, href: "/dashboard/student" },
  ];

  if (isSelfStudy) {
    return (
      <DashboardLayout>
        <div className="space-y-8">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
              Hello, {displayName}!
            </h1>
            <p className="text-muted-foreground mt-1">
              Your self-study hub. Use Study Hub for AI-powered practice, then track progress in My Library and Progress.
            </p>
          </div>

          <OnboardingChecklist title="Your first steps" items={selfStudyChecklistItems} hideWhenComplete={false} />

          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-primary" />
                  Join a classroom
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Have a code from your tutor? Join their classroom to see assignments, quizzes, and course materials.
                </p>
              </div>
              <Button onClick={() => setJoinDialogOpen(true)} className="shrink-0">
                <UserPlus className="mr-2 h-4 w-4" />
                Join with code
              </Button>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Link
              href="/dashboard/student/study"
              className="rounded-2xl border border-border bg-card p-6 hover:border-primary/30 hover:shadow-md transition-all flex flex-col"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
                <GraduationCap className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-foreground">Study Hub</h3>
              <p className="text-sm text-muted-foreground mt-1 flex-1">
                AI Study Coach: summaries, flashcards, practice questions from your materials.
              </p>
              <span className="text-primary text-sm font-medium mt-2 inline-flex items-center">Open Study Hub →</span>
            </Link>
            <Link
              href="/dashboard/student/practice-tests"
              className="rounded-2xl border border-border bg-card p-6 hover:border-primary/30 hover:shadow-md transition-all flex flex-col"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
                <ClipboardList className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-foreground">Practice Tests</h3>
              <p className="text-sm text-muted-foreground mt-1 flex-1">
                Generate and take practice quizzes for self-assessment.
              </p>
              <span className="text-primary text-sm font-medium mt-2 inline-flex items-center">Practice Tests →</span>
            </Link>
            <Link
              href="/dashboard/student/library"
              className="rounded-2xl border border-border bg-card p-6 hover:border-primary/30 hover:shadow-md transition-all flex flex-col"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
                <Library className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-foreground">My Library</h3>
              <p className="text-sm text-muted-foreground mt-1 flex-1">
                Your documents and saved AI outputs in one place.
              </p>
              <span className="text-primary text-sm font-medium mt-2 inline-flex items-center">My Library →</span>
            </Link>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-2">Track your progress</h2>
            <p className="text-sm text-muted-foreground mb-4">
              See your study activity and goals on the Progress page.
            </p>
            <Button asChild variant="outline">
              <Link href="/dashboard/student/progress">View Progress</Link>
            </Button>
          </div>
        </div>
        <JoinClassroomDialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
            Hello, {displayName}!
          </h1>
          <p className="text-muted-foreground mt-1">
            Keep up the great work! Here&apos;s your learning progress.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-card rounded-2xl border border-border p-6 hover:shadow-large hover:border-primary/20 transition-all duration-300"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${stat.iconClass}`}>
                  <stat.icon className="w-6 h-6" />
                </div>
              </div>
              <div className="text-3xl font-bold mb-1 text-foreground">{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
              <div className="text-xs text-brand-lime-dark mt-2 font-medium">{stat.change}</div>
            </div>
          ))}
        </div>

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Upcoming Assignments */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-foreground">
              <Clock className="w-5 h-5 text-muted-foreground" />
              Upcoming Assignments
            </h2>
            <div className="space-y-4">
              {upcomingAssignments.map((assignment, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-xl border transition-all duration-200 ${
                    assignment.urgent
                      ? "border-destructive/30 bg-destructive/5 hover:border-destructive/50"
                      : "border-border bg-secondary/30 hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-foreground">{assignment.title}</p>
                      <p className="text-sm text-muted-foreground">{assignment.course}</p>
                    </div>
                    <Badge variant={assignment.urgent ? "destructive" : "neutral"}>
                      {assignment.due}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Study Recommendations */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-foreground">
              <Lightbulb className="w-5 h-5 text-brand-lime-dark" />
              AI Study Recommendations
            </h2>
            <div className="space-y-4">
              {studyRecommendations.map((rec, index) => (
                <div key={index} className="p-4 rounded-xl bg-secondary/30 border border-border hover:border-primary/20 transition-all duration-200">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-medium text-foreground">{rec.topic}</p>
                      <p className="text-xs text-muted-foreground">{rec.reason}</p>
                    </div>
                    <span className="text-sm font-medium text-foreground">{rec.progress}%</span>
                  </div>
                  <Progress 
                    value={rec.progress} 
                    variant={rec.progress < 50 ? "default" : rec.progress < 75 ? "default" : "success"}
                    className="h-2"
                  />
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full mt-4 hover:bg-primary/5 hover:border-primary/30 hover:text-primary">
              <div className="flex items-center justify-center gap-2">
                <Brain className="w-5 h-5" />
                Start AI Study Session
              </div>
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentDashboard;
