import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ClipboardList, BookOpen, Sparkles } from "lucide-react";

const StudentPracticeTests = () => {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
            Practice Tests
          </h1>
          <p className="text-muted-foreground mt-1">
            Test yourself with AI-generated quizzes and track your progress.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-border hover:border-primary/30 transition-colors">
            <CardHeader>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-2">
                <Sparkles className="h-6 w-6" />
              </div>
              <CardTitle>Study Hub</CardTitle>
              <CardDescription>
                Use the AI Study Coach to generate practice questions from your notes and materials.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="default" className="w-full">
                <Link href="/dashboard/student/study">
                  <BookOpen className="mr-2 h-4 w-4" />
                  Open Study Hub
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border hover:border-primary/30 transition-colors">
            <CardHeader>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-2">
                <ClipboardList className="h-6 w-6" />
              </div>
              <CardTitle>Self-paced quizzes</CardTitle>
              <CardDescription>
                When you join a classroom, your tutor&apos;s quizzes will appear under Quizzes. Use Study Hub for self-study practice.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full" disabled>
                <span>Join a class to get tutor quizzes</span>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentPracticeTests;
