import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { FileText, Trash2, ArrowLeft, Star, ExternalLink, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type FavouriteFilter = "all" | "favourites";

const isFavorite = (item: AIGeneratedContent): boolean =>
  !!(item.metadata && typeof item.metadata === "object" && (item.metadata as { is_favorite?: boolean }).is_favorite);

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

function itemMatchesSearch(item: AIGeneratedContent, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  if (item.title?.toLowerCase().includes(q)) return true;
  if (item.content_type?.toLowerCase().includes(q)) return true;
  const contentStr =
    typeof item.content === "object" && item.content?.text
      ? String((item.content as { text?: string }).text)
      : String(item.content ?? "");
  if (contentStr.toLowerCase().includes(q)) return true;
  if (item.metadata && typeof item.metadata === "object") {
    const metaStr = JSON.stringify(item.metadata).toLowerCase();
    if (metaStr.includes(q)) return true;
  }
  return false;
}

const TeacherAIStudioHistory = () => {
  const { usage, getUsagePercentage, isNearLimit } = useAIUsage();
  const { fetchGeneratedContent, deleteGeneratedContent, toggleFavorite, loading } = useAIStudio();
  const { toast } = useToast();
  const [history, setHistory] = useState<AIGeneratedContent[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [favouriteFilter, setFavouriteFilter] = useState<FavouriteFilter>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AIGeneratedContent | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [favoriteTogglingId, setFavoriteTogglingId] = useState<string | null>(null);

  const handleToggleFavorite = async (id: string) => {
    setFavoriteTogglingId(id);
    const success = await toggleFavorite(id);
    setFavoriteTogglingId(null);
    if (success) await loadHistory();
  };

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
    } catch (error: unknown) {
      console.error("Error deleting generated content:", error);
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Could not delete generated content. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  };

  const usagePercentage = getUsagePercentage();

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
            <h1 className="text-3xl font-bold text-foreground">History</h1>
            <p className="text-muted-foreground mt-1">
              View, save, and manage your generated content
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

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Generated Content History</h2>

          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title, type, or content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex rounded-md border border-input overflow-hidden shrink-0">
              <button
                type="button"
                onClick={() => setFavouriteFilter("all")}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors",
                  favouriteFilter === "all"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                )}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFavouriteFilter("favourites")}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors flex items-center gap-1",
                  favouriteFilter === "favourites"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                )}
              >
                <Star className="h-4 w-4" />
                Favourites
              </button>
            </div>
          </div>

          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : history.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No generated content yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                <Link href="/dashboard/teacher/ai-studio" className="text-primary hover:underline">
                  Go to AI Studio
                </Link>{" "}
                and use Smart Tutor or Rubric to create content
              </p>
            </div>
          ) : (() => {
              const filtered = history
                .slice()
                .filter((item) => itemMatchesSearch(item, searchQuery))
                .filter((item) => favouriteFilter === "all" || isFavorite(item))
                .sort((a, b) => (isFavorite(a) ? 0 : 1) - (isFavorite(b) ? 0 : 1));
              if (filtered.length === 0) {
                return (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>
                      {favouriteFilter === "favourites"
                        ? "No favourite items match your search."
                        : "No items match your search."}
                    </p>
                    <p className="text-sm mt-2">
                      Try changing the search or {favouriteFilter === "favourites" ? "view All" : "clear the search"}.
                    </p>
                  </div>
                );
              }
              return (
            <div className="space-y-4">
              {filtered.map((item) => (
                  <Card key={item.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0 flex items-start gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "shrink-0 h-8 w-8",
                            isFavorite(item) && "text-amber-500 hover:text-amber-600"
                          )}
                          onClick={() => handleToggleFavorite(item.id)}
                          disabled={favoriteTogglingId === item.id}
                          aria-label={isFavorite(item) ? "Remove from favorites" : "Add to favorites"}
                        >
                          <Star
                            className={cn("h-4 w-4", isFavorite(item) ? "fill-current" : "")}
                          />
                        </Button>
                        <div className="min-w-0">
                          <Link
                            href={`/dashboard/teacher/ai-studio/output/${item.id}`}
                            className="font-semibold text-foreground hover:text-primary hover:underline block truncate"
                          >
                            {item.title}
                          </Link>
                          <p className="text-sm text-muted-foreground">
                            Created {formatCreatedAt(item.created_at)}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <Badge variant="outline">{item.content_type}</Badge>
                            {item.metadata &&
                              Object.entries(item.metadata)
                                .filter(([key]) => key !== "is_favorite")
                                .map(([key, value]) => (
                                  <Badge key={key} variant="secondary" className="text-xs">
                                    {key}: {formatMetadataValue(value)}
                                  </Badge>
                                ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/dashboard/teacher/ai-studio/output/${item.id}`}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDeleteTarget(item);
                            setDeleteDialogOpen(true);
                          }}
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
            </div>
              );
            })()}
        </Card>
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

export default TeacherAIStudioHistory;
