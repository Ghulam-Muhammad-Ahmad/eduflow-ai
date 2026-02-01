import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Users, BookOpen, Sparkles, ClipboardList } from "lucide-react";
import { toast } from "sonner";

type AppRole = "teacher" | "student";

export default function ChooseRole() {
  const router = useRouter();
  const { user, role, loading: authLoading, setRoleForOAuthUser } = useAuth();
  const [selecting, setSelecting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/auth");
      return;
    }
    if (role) {
      if (role === "teacher") router.replace("/dashboard/teacher");
      else if (role === "admin") router.replace("/dashboard/admin");
      else router.replace("/dashboard/student");
    }
  }, [user, role, authLoading, router]);

  const handleSelect = async (selectedRole: AppRole) => {
    setSelecting(true);
    const { error } = await setRoleForOAuthUser(selectedRole);
    setSelecting(false);
    if (error) {
      toast.error(error.message || "Failed to set role");
      return;
    }
    toast.success("Welcome!");
    if (selectedRole === "teacher") router.replace("/dashboard/teacher");
    else router.replace("/dashboard/student");
  };

  if (authLoading || !user || role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-4xl overflow-hidden rounded-3xl border border-border bg-card shadow-large">
        {/* Left panel - branding */}
        <div className="hidden w-[40%] bg-gradient-to-br from-primary/90 via-primary to-primary/80 p-8 lg:flex lg:flex-col lg:justify-center">
          <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm w-fit">
            <Image 
              src="/mainlogo.svg" 
              alt="EduLabLoom Logo" 
              width={48} 
              height={48}
              className="h-12 w-12"
            />
          </div>
          <h2 className="mt-6 text-xl font-semibold text-white">
            Welcome to EduLabLoom
          </h2>
          <p className="mt-2 text-sm text-white/90">
            Choose how you&apos;ll use the platform. This choice cannot be changed later.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-white/90">
            <li className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-white" />
              AI-powered teaching & learning
            </li>
            <li className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-white" />
              Assignments, quizzes & classrooms
            </li>
          </ul>
        </div>

        {/* Right panel - role selection */}
        <div className="flex w-full flex-col justify-center px-8 py-10 lg:w-[60%] lg:px-12 lg:py-14">
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Choose your role
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              How will you use EduFlow? This cannot be changed later.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => handleSelect("teacher")}
              disabled={selecting}
              className="group flex flex-col items-center gap-4 rounded-2xl border-2 border-border bg-card p-8 text-left transition-all duration-200 hover:border-primary hover:bg-primary/5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-60 disabled:pointer-events-none"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                <Users className="h-8 w-8" />
              </div>
              <div className="space-y-1 text-center">
                <span className="block font-semibold text-foreground">Teacher</span>
                <span className="block text-sm text-muted-foreground">
                  Create classrooms, assignments & quizzes. Use AI grading and lesson planning.
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleSelect("student")}
              disabled={selecting}
              className="group flex flex-col items-center gap-4 rounded-2xl border-2 border-border bg-card p-8 text-left transition-all duration-200 hover:border-primary hover:bg-primary/5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-60 disabled:pointer-events-none"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                <BookOpen className="h-8 w-8" />
              </div>
              <div className="space-y-1 text-center">
                <span className="block font-semibold text-foreground">Student</span>
                <span className="block text-sm text-muted-foreground">
                  Join classes, complete assignments & quizzes. Use AI study tools.
                </span>
              </div>
            </button>
          </div>

          {selecting && (
            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Setting up your account...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
