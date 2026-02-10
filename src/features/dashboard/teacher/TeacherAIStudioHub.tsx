import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAIUsage } from "@/hooks/useAIUsage";
import { TrendingUp, ListChecks, History, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const options = [
  {
    title: "Smart Tutor",
    description: "Adapt content for different learning levels and needs.",
    href: "/dashboard/teacher/ai-studio/smart-tutor",
    icon: TrendingUp,
  },
  {
    title: "Rubric",
    description: "Build assessment rubrics for assignments and projects.",
    href: "/dashboard/teacher/ai-studio/rubric",
    icon: ListChecks,
  },
  {
    title: "History",
    description: "View, save, and manage your generated content.",
    href: "/dashboard/teacher/ai-studio/history",
    icon: History,
  },
];

const TeacherAIStudioHub = () => {
  const { usage, getUsagePercentage, isNearLimit } = useAIUsage();
  const usagePercentage = getUsagePercentage();

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">AI Studio</h1>
          <p className="text-muted-foreground mt-1">
            Generate educational content with AI assistance. Choose a tool to get started.
          </p>
        </div>

        {usage && (
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Monthly AI Usage</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xl font-bold">
                    {usage.current_usage} / {usage.limit}
                  </span>
                  <Badge variant={isNearLimit() ? "destructive" : "default"}>
                    {usage.remaining} remaining
                  </Badge>
                </div>
              </div>
              <div className="flex-1 max-w-xs ml-4">
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className={cn(
                      "h-2 rounded-full transition-all",
                      usagePercentage >= 100 && "bg-destructive",
                      usagePercentage >= 80 && usagePercentage < 100 && "bg-orange-500",
                      usagePercentage < 80 && "bg-primary"
                    )}
                    style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                  />
                </div>
                {isNearLimit() && (
                  <p className="text-xs text-destructive mt-1">
                    You&apos;re approaching your monthly limit
                  </p>
                )}
              </div>
            </div>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {options.map((opt) => {
            const Icon = opt.icon;
            return (
              <Link key={opt.href} href={opt.href}>
                <Card
                  className="p-6 h-full transition-colors hover:bg-accent/50 hover:border-primary/30 cursor-pointer group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                          <Icon className="h-5 w-5" />
                        </div>
                        <h2 className="text-xl font-semibold">{opt.title}</h2>
                      </div>
                      <p className="text-sm text-muted-foreground">{opt.description}</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0 ml-2" />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TeacherAIStudioHub;
