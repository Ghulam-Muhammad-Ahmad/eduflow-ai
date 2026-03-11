import { useState, useEffect } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  HelpCircle,
  BookOpen,
  Calendar,
  Sparkles,
  Lightbulb,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useAIPrep } from "@/hooks/useAIPrep";
import { useAIUsage } from "@/hooks/useAIUsage";
import { useStudentAssignments } from "@/hooks/useAssignments";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const StudentAIPrep = () => {
  useAuth();
  const { usage, isNearLimit } = useAIUsage();
  const {
    generateSummary,
    generateFlashcards,
    generatePracticeQuestions,
    explainConceptSimple,
    createStudyPlan,
    fetchStudyMaterials,
    loading,
  } = useAIPrep();
  const { toast } = useToast();
  const { data: assignments } = useStudentAssignments();

  const [activeTab, setActiveTab] = useState("summary");
  const [sourceMaterial, setSourceMaterial] = useState("");
  const [concept, setConcept] = useState("");
  const [context, setContext] = useState("");
  const [numQuestions, setNumQuestions] = useState(10);
  const [availableTime, setAvailableTime] = useState(10);
  const [result, setResult] = useState<string>("");
  type StudyMaterialItem = { id?: string; title?: string; content?: string; content_type?: string; created_at?: string };
  const [studyMaterials, setStudyMaterials] = useState<StudyMaterialItem[]>([]);

  useEffect(() => {
    loadStudyMaterials();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadStudyMaterials = async () => {
    try {
      const materials = await fetchStudyMaterials();
      setStudyMaterials(materials as StudyMaterialItem[]);
    } catch (error) {
      console.error("Failed to load study materials:", error);
      toast({
        title: "Unable to load study materials",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    }
  };

  const handleGenerateSummary = async () => {
    if (!sourceMaterial.trim()) {
      toast({
        title: "Error",
        description: "Please enter source material",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await generateSummary(sourceMaterial);
      if (response?.success) {
        setResult(response.content);
        loadStudyMaterials();
      } else {
        toast({
          title: "Summary generation failed",
          description: "Please try again with different content.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error generating summary:", error);
      toast({
        title: "Summary generation failed",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    }
  };

  const handleGenerateFlashcards = async () => {
    if (!sourceMaterial.trim()) {
      toast({
        title: "Error",
        description: "Please enter source material",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await generateFlashcards(sourceMaterial);
      if (response?.success) {
        setResult(response.content);
        loadStudyMaterials();
      } else {
        toast({
          title: "Flashcard generation failed",
          description: "Please try again with different content.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error generating flashcards:", error);
      toast({
        title: "Flashcard generation failed",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    }
  };

  const handleGenerateQuestions = async () => {
    if (!sourceMaterial.trim()) {
      toast({
        title: "Error",
        description: "Please enter source material",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await generatePracticeQuestions(sourceMaterial, numQuestions);
      if (response?.success) {
        setResult(response.content);
        loadStudyMaterials();
      } else {
        toast({
          title: "Question generation failed",
          description: "Please try again with different content.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error generating practice questions:", error);
      toast({
        title: "Question generation failed",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    }
  };

  const handleExplainConcept = async () => {
    if (!concept.trim()) {
      toast({
        title: "Error",
        description: "Please enter a concept to explain",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await explainConceptSimple(concept, context || undefined);
      if (response?.success) {
        setResult(response.content);
        loadStudyMaterials();
      } else {
        toast({
          title: "Explanation failed",
          description: "Please try again with a different concept.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error explaining concept:", error);
      toast({
        title: "Explanation failed",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    }
  };

  const handleGenerateStudyPlan = async () => {
    // Get upcoming assignments
    const upcoming = assignments
      ?.filter((a) => {
        if (!a.due_date) return false;
        const dueDate = new Date(a.due_date);
        return dueDate > new Date();
      })
      .map((a) => ({
        title: a.title,
        dueDate: a.due_date ? new Date(a.due_date).toLocaleDateString() : "",
      })) || [];

    if (upcoming.length === 0) {
      toast({
        title: "No Upcoming Assignments",
        description: "You don't have any upcoming assignments to create a study plan for",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await createStudyPlan(upcoming, availableTime);
      if (response?.success) {
        setResult(response.content);
        loadStudyMaterials();
      } else {
        toast({
          title: "Study plan generation failed",
          description: "Please try again in a moment.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error generating study plan:", error);
      toast({
        title: "Study plan generation failed",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    }
  };

  const handleNumQuestionsChange = (value: string) => {
    const parsed = parseInt(value, 10);
    const fallback = 10;
    const min = 1;
    const max = 20;
    const normalized = Number.isNaN(parsed) ? fallback : Math.min(max, Math.max(min, parsed));
    setNumQuestions(normalized);
  };

  const handleViewMaterial = (material: { content?: string; content_type?: string }) => {
    if (!material?.content) {
      toast({
        title: "Unable to open material",
        description: "This material is missing content.",
        variant: "destructive",
      });
      return;
    }

    const allowedTabs = new Set(["summary", "flashcards", "questions", "explain", "plan"]);
    if (material.content_type && allowedTabs.has(material.content_type)) {
      setActiveTab(material.content_type);
    }
    setResult(material.content);
  };

  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">AI Prep - Study Hub</h1>
            <p className="text-muted-foreground mt-1">
              AI-powered study tools to help you prepare effectively
            </p>
          </div>
          {isNearLimit() && (
            <Badge variant="destructive">
              {usage?.remaining} AI requests remaining
            </Badge>
          )}
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
            </div>
          </Card>
        )}

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="summary">
              <FileText className="h-4 w-4 mr-2" />
              Summary
            </TabsTrigger>
            <TabsTrigger value="flashcards">
              <BookOpen className="h-4 w-4 mr-2" />
              Flashcards
            </TabsTrigger>
            <TabsTrigger value="questions">
              <HelpCircle className="h-4 w-4 mr-2" />
              Practice
            </TabsTrigger>
            <TabsTrigger value="explain">
              <Lightbulb className="h-4 w-4 mr-2" />
              Explain
            </TabsTrigger>
            <TabsTrigger value="plan">
              <Calendar className="h-4 w-4 mr-2" />
              Study Plan
            </TabsTrigger>
          </TabsList>

          <TabsContent value="summary">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Generate Summary</h2>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="summary-source">Source Material</Label>
                  <Textarea
                    id="summary-source"
                    value={sourceMaterial}
                    onChange={(e) => setSourceMaterial(e.target.value)}
                    placeholder="Paste your notes, textbook content, or study materials here..."
                    rows={10}
                  />
                </div>
                <Button onClick={handleGenerateSummary} disabled={loading} className="w-full">
                  {loading ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Summary
                    </>
                  )}
                </Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="flashcards">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Generate Flashcards</h2>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="flashcard-source">Source Material</Label>
                  <Textarea
                    id="flashcard-source"
                    value={sourceMaterial}
                    onChange={(e) => setSourceMaterial(e.target.value)}
                    placeholder="Paste your study material to generate flashcards..."
                    rows={10}
                  />
                </div>
                <Button onClick={handleGenerateFlashcards} disabled={loading} className="w-full">
                  {loading ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <BookOpen className="h-4 w-4 mr-2" />
                      Generate Flashcards
                    </>
                  )}
                </Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="questions">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Practice Questions</h2>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="question-source">Source Material</Label>
                  <Textarea
                    id="question-source"
                    value={sourceMaterial}
                    onChange={(e) => setSourceMaterial(e.target.value)}
                    placeholder="Paste your study material to generate practice questions..."
                    rows={8}
                  />
                </div>
                <div>
                  <Label htmlFor="numQuestions">Number of Questions</Label>
                  <Input
                    id="numQuestions"
                    type="number"
                    min="1"
                    max="20"
                    value={numQuestions}
                    onChange={(e) => handleNumQuestionsChange(e.target.value)}
                  />
                </div>
                <Button onClick={handleGenerateQuestions} disabled={loading} className="w-full">
                  {loading ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <HelpCircle className="h-4 w-4 mr-2" />
                      Generate Practice Questions
                    </>
                  )}
                </Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="explain">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Explain Concept</h2>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="concept">Concept to Explain *</Label>
                  <Input
                    id="concept"
                    value={concept}
                    onChange={(e) => setConcept(e.target.value)}
                    placeholder="e.g., Photosynthesis, Quadratic Equations, World War II"
                  />
                </div>
                <div>
                  <Label htmlFor="context">Additional Context (Optional)</Label>
                  <Textarea
                    id="context"
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder="Provide any additional context or specify what aspect you want explained..."
                    rows={4}
                  />
                </div>
                <Button onClick={handleExplainConcept} disabled={loading} className="w-full">
                  {loading ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Explaining...
                    </>
                  ) : (
                    <>
                      <Lightbulb className="h-4 w-4 mr-2" />
                      Explain Concept
                    </>
                  )}
                </Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="plan">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Study Plan Generator</h2>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="availableTime">Available Study Time (hours per week)</Label>
                  <Input
                    id="availableTime"
                    type="number"
                    min="1"
                    max="40"
                    value={availableTime}
                    onChange={(e) => setAvailableTime(parseInt(e.target.value) || 10)}
                  />
                </div>
                <div className="p-4 bg-secondary rounded-lg">
                  <p className="text-sm font-medium mb-2">Upcoming Assignments:</p>
                  {assignments
                    ?.filter((a) => {
                      if (!a.due_date) return false;
                      return new Date(a.due_date) > new Date();
                    })
                    .map((a) => (
                      <div key={a.id} className="text-sm text-muted-foreground">
                        • {a.title} - Due: {a.due_date ? new Date(a.due_date).toLocaleDateString() : "N/A"}
                      </div>
                    )) || <p className="text-sm text-muted-foreground">No upcoming assignments</p>}
                </div>
                <Button onClick={handleGenerateStudyPlan} disabled={loading} className="w-full">
                  {loading ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Calendar className="h-4 w-4 mr-2" />
                      Generate Study Plan
                    </>
                  )}
                </Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Results */}
        {result && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Generated Content</h3>
            <div className="prose max-w-none">
              <pre className="whitespace-pre-wrap text-sm bg-secondary p-4 rounded-lg">
                {result}
              </pre>
            </div>
          </Card>
        )}

        {/* Saved Materials */}
        {studyMaterials.length > 0 && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Saved Study Materials</h3>
            <div className="space-y-2">
              {studyMaterials.slice(0, 5).map((material, index) => (
                <div
                  key={material.id ?? index}
                  className="flex items-center justify-between p-3 bg-secondary rounded-lg"
                >
                  <div>
                    <p className="font-medium">{material.title ?? "Untitled"}</p>
                    <p className="text-xs text-muted-foreground">
                      {material.content_type ?? ""} • {material.created_at ? new Date(material.created_at).toLocaleDateString() : ""}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewMaterial(material)}
                  >
                    View
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default StudentAIPrep;
