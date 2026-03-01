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
import { Library, FileText, BookOpen } from "lucide-react";

const StudentMyLibrary = () => {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
            My Library
          </h1>
          <p className="text-muted-foreground mt-1">
            Your saved documents and AI-generated study materials in one place.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-border hover:border-primary/30 transition-colors">
            <CardHeader>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-2">
                <FileText className="h-6 w-6" />
              </div>
              <CardTitle>My Documents</CardTitle>
              <CardDescription>
                Upload and manage your own files. Use them in Study Hub for summaries, flashcards, and practice questions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="default" className="w-full">
                <Link href="/dashboard/student/documents">
                  <Library className="mr-2 h-4 w-4" />
                  Open My Documents
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border hover:border-primary/30 transition-colors">
            <CardHeader>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-2">
                <BookOpen className="h-6 w-6" />
              </div>
              <CardTitle>Study Hub outputs</CardTitle>
              <CardDescription>
                Summaries, flashcards, and practice questions you generate in Study Hub are available from the Study Hub page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/dashboard/student/study">
                  Go to Study Hub
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentMyLibrary;
