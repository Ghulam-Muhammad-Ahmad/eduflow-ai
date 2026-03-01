import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TrendingUp, BookOpen, Target, Sparkles } from "lucide-react";

const StudentProgress = () => {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
            Progress
          </h1>
          <p className="text-muted-foreground mt-1">
            Track your self-study activity and goals.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="border-border">
            <CardHeader className="pb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <BookOpen className="h-5 w-5" />
              </div>
              <CardTitle className="text-base">Study sessions</CardTitle>
              <CardDescription>Use Study Hub to build a history of sessions.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">—</p>
              <p className="text-xs text-muted-foreground">Coming soon</p>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Target className="h-5 w-5" />
              </div>
              <CardTitle className="text-base">Goals</CardTitle>
              <CardDescription>Set and track your study goals.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">—</p>
              <p className="text-xs text-muted-foreground">Coming soon</p>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <CardTitle className="text-base">AI usage</CardTitle>
              <CardDescription>Your AI Study Coach usage is shown in the sidebar.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Check the AI Credits bar below the nav.</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Keep building
            </CardTitle>
            <CardDescription>
              Use Study Hub regularly to create summaries, flashcards, and practice questions. When you join a classroom, assignment and quiz progress will appear here too.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Self-study progress</span>
                <span className="font-medium">—</span>
              </div>
              <Progress value={0} className="h-2" />
            </div>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/dashboard/student/study">Open Study Hub</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default StudentProgress;
