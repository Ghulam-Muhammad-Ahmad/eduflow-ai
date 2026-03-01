import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useAIStudio, type AIGeneratedContent } from "@/hooks/useAIStudio";
import { AIStudioOutputView } from "@/components/ai/AIStudioOutputView";
import { ArrowLeft, Loader2 } from "lucide-react";

const TeacherAIStudioOutput = () => {
  const router = useRouter();
  const { id } = router.query;
  const { fetchGeneratedContentById } = useAIStudio();
  const [item, setItem] = useState<AIGeneratedContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (typeof id !== "string") return;
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    fetchGeneratedContentById(id).then((data) => {
      if (cancelled) return;
      setLoading(false);
      if (data) setItem(data);
      else setNotFound(true);
    });
    return () => { cancelled = true; };
    // Only re-fetch when id changes; fetchGeneratedContentById is stable enough for this use
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (typeof id !== "string" || !id) {
    return (
      <DashboardLayout role="teacher">
        <div className="space-y-6">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/teacher/ai-studio" aria-label="Back to AI Content Generator">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <p className="text-muted-foreground">Invalid output ID.</p>
        </div>
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout role="teacher">
        <div className="flex items-center justify-center min-h-[200px] gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Loading...</span>
        </div>
      </DashboardLayout>
    );
  }

  if (notFound || !item) {
    return (
      <DashboardLayout role="teacher">
        <div className="space-y-6">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/teacher/ai-studio" aria-label="Back to AI Content Generator">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <p className="text-muted-foreground">Content not found or you don’t have access to it.</p>
          <Button asChild>
            <Link href="/dashboard/teacher/ai-studio">Go to AI Content Generator</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/teacher/ai-studio" aria-label="Back to AI Content Generator">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-foreground truncate">{item.title}</h1>
            <p className="text-sm text-muted-foreground">
              {item.content_type} • View and manage this generation
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/teacher/ai-studio/history">History</Link>
          </Button>
        </div>

        <AIStudioOutputView item={item} onUpdated={setItem} />
      </div>
    </DashboardLayout>
  );
};

export default TeacherAIStudioOutput;
