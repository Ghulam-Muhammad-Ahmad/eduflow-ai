import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import CheckerPresets from "@/components/teacher/CheckerPresets";
import { ArrowLeft } from "lucide-react";

const TeacherCheckerPresets = () => {
  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/teacher/checker" aria-label="Back to AI Checker">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Checker Presets</h1>
            <p className="text-muted-foreground mt-1">
              Create and manage grading presets with rubrics, instructions, and optional reference documents
            </p>
          </div>
        </div>

        <CheckerPresets />
      </div>
    </DashboardLayout>
  );
};

export default TeacherCheckerPresets;
