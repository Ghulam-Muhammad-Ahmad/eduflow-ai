import { useState, useEffect } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useAIStudio, AIGeneratedContent } from "@/hooks/useAIStudio";
import { useAIUsage } from "@/hooks/useAIUsage";
import { Sparkles, FileText, HelpCircle, ListChecks, Lightbulb, TrendingUp, History, Save, Download, Trash2 } from "lucide-react";
import ContentGenerator from "@/components/ai/ContentGenerator";
import DifferentiationAssistant from "@/components/ai/DifferentiationAssistant";
import RubricGenerator from "@/components/ai/RubricGenerator";
import QuizQuestionGenerator from "@/components/ai/QuizQuestionGenerator";

const TeacherAIStudio = () => {
  const { usage, monthlyUsage, getUsagePercentage, isNearLimit } = useAIUsage();
  const { fetchGeneratedContent, deleteGeneratedContent, loading } = useAIStudio();
  const [activeTab, setActiveTab] = useState("generate");
  const [history, setHistory] = useState<AIGeneratedContent[]>([]);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const content = await fetchGeneratedContent();
    setHistory(content);
  };

  const handleDelete = async (id: string) => {
    const success = await deleteGeneratedContent(id);
    if (success) {
      loadHistory();
    }
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
                    You're approaching your monthly limit
                  </p>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
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
            <TabsTrigger value="quiz">
              <HelpCircle className="h-4 w-4 mr-2" />
              Quiz Questions
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

          <TabsContent value="quiz">
            <QuizQuestionGenerator onContentGenerated={loadHistory} />
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
                            Created {new Date(item.created_at).toLocaleDateString()}
                          </p>
                          {item.metadata && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {Object.entries(item.metadata).map(([key, value]) => (
                                <Badge key={key} variant="secondary" className="text-xs">
                                  {key}: {String(value)}
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
                            onClick={() => handleDelete(item.id)}
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
    </DashboardLayout>
  );
};

export default TeacherAIStudio;
