import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAIUsage } from "@/hooks/useAIUsage";
import { useAIStudio } from "@/hooks/useAIStudio";
import RubricGenerator from "@/components/ai/RubricGenerator";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const TeacherAIStudioRubric = () => {
  const { usage, getUsagePercentage, isNearLimit } = useAIUsage();
  const { fetchGeneratedContent } = useAIStudio();
  const usagePercentage = getUsagePercentage();

  const loadHistory = () => fetchGeneratedContent();

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/teacher/ai-studio" aria-label="Back to AI Studio">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Rubric</h1>
            <p className="text-muted-foreground mt-1">
              Build assessment rubrics for assignments and projects
            </p>
          </div>
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

        <RubricGenerator onContentGenerated={loadHistory} />
      </div>
    </DashboardLayout>
  );
};

export default TeacherAIStudioRubric;
