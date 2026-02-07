import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAIStudio, AIGeneratedContent } from "@/hooks/useAIStudio";
import { useAIUsage } from "@/hooks/useAIUsage";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, FileText, ListChecks, TrendingUp, History, Save, Download, Trash2 } from "lucide-react";
import ContentGenerator from "@/components/ai/ContentGenerator";
import DifferentiationAssistant from "@/components/ai/DifferentiationAssistant";
import RubricGenerator from "@/components/ai/RubricGenerator";

const TeacherAIStudio = () => {
  const { usage, getUsagePercentage, isNearLimit } = useAIUsage();
  const { fetchGeneratedContent, deleteGeneratedContent, loading } = useAIStudio();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("generate");
  const [history, setHistory] = useState<AIGeneratedContent[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AIGeneratedContent | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const loadHistory = useCallback(async () => {
    const content = await fetchGeneratedContent();
    setHistory(content);
  }, [fetchGeneratedContent]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleDelete = async (id: string) => {
    try {
      const success = await deleteGeneratedContent(id);
      if (!success) {
        toast({
          title: "Delete failed",
          description: "Could not delete generated content. Please try again.",
          variant: "destructive",
        });
        return false;
      }
      await loadHistory();
      return true;
    } catch (error: any) {
      console.error("Error deleting generated content:", error);
      toast({
        title: "Delete failed",
        description: error?.message || "Could not delete generated content. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  };

  const formatCreatedAt = (dateString: string) =>
    new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(dateString));

  const formatMetadataValue = (value: unknown) => {
    const truncate = (text: string, max = 60) =>
      text.length > max ? `${text.slice(0, max - 3)}...` : text;

    const formatPrimitive = (input: unknown) => {
      if (input === null) return "null";
      if (input === undefined) return "undefined";
      if (typeof input === "string") return truncate(input);
      if (typeof input === "number" || typeof input === "boolean") return String(input);
      try {
        return truncate(JSON.stringify(input));
      } catch {
        return "[object]";
      }
    };

    if (Array.isArray(value)) {
      const preview = value.slice(0, 3).map((item) => formatPrimitive(item));
      const suffix = value.length > 3 ? ", ..." : "";
      return `[${preview.join(", ")}${suffix}]`;
    }

    if (value && typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>);
      const preview = entries
        .slice(0, 3)
        .map(([key, val]) => `${key}: ${formatPrimitive(val)}`);
      const suffix = entries.length > 3 ? ", ..." : "";
      return `{ ${preview.join(", ")}${suffix} }`;
    }

    return formatPrimitive(value);
  };

  const usagePercentage = getUsagePercentage();

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">AI Studio</h1>
            <p className="text-muted-foreground mt-1">
              Generate educational content with AI assistance
            </p>
          </div>
        </div>

        {/* Usage Stats */}
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
                    className={`h-2 rounded-full transition-all ${
                      usagePercentage >= 100
                        ? "bg-destructive"
                        : usagePercentage >= 80
                        ? "bg-orange-500"
                        : "bg-primary"
                    }`}
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

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="generate">
              <Sparkles className="h-4 w-4 mr-2" />
              Generate
            </TabsTrigger>
            <TabsTrigger value="differentiate">
              <TrendingUp className="h-4 w-4 mr-2" />
              Differentiate
            </TabsTrigger>
            <TabsTrigger value="rubric">
              <ListChecks className="h-4 w-4 mr-2" />
              Rubric
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-4 w-4 mr-2" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="generate">
            <ContentGenerator onContentGenerated={loadHistory} />
          </TabsContent>

          <TabsContent value="differentiate">
            <DifferentiationAssistant onContentGenerated={loadHistory} />
          </TabsContent>

          <TabsContent value="rubric">
            <RubricGenerator onContentGenerated={loadHistory} />
          </TabsContent>

          <TabsContent value="history">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Generated Content History</h2>
              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : history.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No generated content yet</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Start generating content using the tabs above
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {history.map((item) => (
                    <Card key={item.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold">{item.title}</h3>
                            <Badge variant="outline">{item.content_type}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Created {formatCreatedAt(item.created_at)}
                          </p>
                          {item.metadata && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {Object.entries(item.metadata).map(([key, value]) => (
                                <Badge key={key} variant="secondary" className="text-xs">
                                  {key}: {formatMetadataValue(value)}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // TODO: Save to documents
                            }}
                          >
                            <Save className="h-4 w-4 mr-2" />
                            Save
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // TODO: Export
                            }}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Export
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDeleteTarget(item);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3 p-3 bg-secondary rounded-lg">
                        <pre className="text-sm whitespace-pre-wrap">
                          {typeof item.content === 'object' 
                            ? item.content.text || JSON.stringify(item.content, null, 2)
                            : item.content}
                        </pre>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete generated content</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `Are you sure you want to delete "${deleteTarget.title}"? This action cannot be undone.`
                : "Are you sure you want to delete this item? This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeleteTarget(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive"
              disabled={deletePending}
              onClick={async (event) => {
                event.preventDefault();
                if (!deleteTarget) return;
                setDeletePending(true);
                const success = await handleDelete(deleteTarget.id);
                setDeletePending(false);
                if (success) {
                  setDeleteDialogOpen(false);
                  setDeleteTarget(null);
                }
              }}
            >
              {deletePending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default TeacherAIStudio;
