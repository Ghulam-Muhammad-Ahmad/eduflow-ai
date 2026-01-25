import { useState, useEffect } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calendar, Loader2, Save, FileText, Sparkles } from "lucide-react";
import { useLessonPlanner } from "@/hooks/useLessonPlanner";
import { useAIUsage } from "@/hooks/useAIUsage";
import { useToast } from "@/hooks/use-toast";

const TeacherLessonPlanner = () => {
  const { usage, isNearLimit } = useAIUsage();
  const { generatePlan, fetchLessonPlans, templates, loading } = useLessonPlanner();
  const { toast } = useToast();

  const [subject, setSubject] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [topic, setTopic] = useState("");
  const [duration, setDuration] = useState(60);
  const [objectives, setObjectives] = useState<string[]>([""]);
  const [standards, setStandards] = useState<string[]>([]);
  const [templateType, setTemplateType] = useState("");
  const [result, setResult] = useState<string>("");
  const [savedPlans, setSavedPlans] = useState<any[]>([]);

  useEffect(() => {
    loadSavedPlans();
  }, []);

  const loadSavedPlans = async () => {
    const plans = await fetchLessonPlans();
    setSavedPlans(plans);
  };

  const addObjective = () => {
    setObjectives([...objectives, ""]);
  };

  const updateObjective = (index: number, value: string) => {
    const updated = [...objectives];
    updated[index] = value;
    setObjectives(updated);
  };

  const removeObjective = (index: number) => {
    if (objectives.length > 1) {
      setObjectives(objectives.filter((_, i) => i !== index));
    }
  };

  const handleGenerate = async () => {
    if (!subject || !gradeLevel || !topic) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const validObjectives = objectives.filter((obj) => obj.trim() !== "");
    if (validObjectives.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one learning objective",
        variant: "destructive",
      });
      return;
    }

    const response = await generatePlan(
      subject,
      gradeLevel,
      topic,
      duration,
      validObjectives,
      standards.length > 0 ? standards : undefined,
      templateType || undefined
    );

    if (response?.success) {
      setResult(response.content);
      toast({
        title: "Success",
        description: "Lesson plan generated successfully",
      });
      loadSavedPlans();
    } else {
      toast({
        title: "Error",
        description: response?.error || "Failed to generate lesson plan",
        variant: "destructive",
      });
    }
  };

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">AI Lesson Planner</h1>
            <p className="text-muted-foreground mt-1">
              Generate comprehensive lesson plans with AI assistance
            </p>
          </div>
          {isNearLimit() && (
            <Badge variant="destructive">
              {usage?.remaining} AI requests remaining
            </Badge>
          )}
        </div>

        <Tabs defaultValue="create" className="space-y-4">
          <TabsList>
            <TabsTrigger value="create">Create New</TabsTrigger>
            <TabsTrigger value="saved">Saved Plans</TabsTrigger>
          </TabsList>

          <TabsContent value="create">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Lesson Plan Details</h2>

              <div className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="subject">Subject *</Label>
                    <Select value={subject} onValueChange={setSubject}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Math">Math</SelectItem>
                        <SelectItem value="Science">Science</SelectItem>
                        <SelectItem value="English">English</SelectItem>
                        <SelectItem value="History">History</SelectItem>
                        <SelectItem value="Geography">Geography</SelectItem>
                        <SelectItem value="Art">Art</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="gradeLevel">Grade Level *</Label>
                    <Select value={gradeLevel} onValueChange={setGradeLevel}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select grade" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Elementary">Elementary (K-5)</SelectItem>
                        <SelectItem value="Middle School">Middle School (6-8)</SelectItem>
                        <SelectItem value="High School">High School (9-12)</SelectItem>
                        <SelectItem value="College">College</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="duration">Duration (minutes) *</Label>
                    <Input
                      id="duration"
                      type="number"
                      min="15"
                      max="180"
                      value={duration}
                      onChange={(e) => setDuration(parseInt(e.target.value) || 60)}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="topic">Topic *</Label>
                  <Input
                    id="topic"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g., Photosynthesis, World War II, Fractions"
                  />
                </div>

                <div>
                  <Label>Learning Objectives *</Label>
                  <div className="space-y-2 mt-2">
                    {objectives.map((obj, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          value={obj}
                          onChange={(e) => updateObjective(index, e.target.value)}
                          placeholder={`Objective ${index + 1}`}
                        />
                        {objectives.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeObjective(index)}
                          >
                            ×
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addObjective}>
                      + Add Objective
                    </Button>
                  </div>
                </div>

                <div>
                  <Label>Template Type (Optional)</Label>
                  <Select value={templateType || undefined} onValueChange={setTemplateType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select template (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="standards">Curriculum Standards (Optional)</Label>
                  <Textarea
                    id="standards"
                    value={standards.join("\n")}
                    onChange={(e) => setStandards(e.target.value.split("\n").filter((s) => s.trim()))}
                    placeholder="Enter curriculum standards, one per line"
                    rows={3}
                  />
                </div>

                <Button onClick={handleGenerate} disabled={loading} className="w-full" size="lg">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating Lesson Plan...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Lesson Plan
                    </>
                  )}
                </Button>
              </div>
            </Card>

            {result && (
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Generated Lesson Plan</h3>
                <div className="prose max-w-none">
                  <pre className="whitespace-pre-wrap text-sm bg-secondary p-4 rounded-lg">
                    {result}
                  </pre>
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="saved">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Saved Lesson Plans</h2>
              {savedPlans.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No saved lesson plans yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {savedPlans.map((plan) => (
                    <Card key={plan.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold">{plan.title}</h3>
                          <div className="flex gap-2 mt-2">
                            {plan.metadata?.subject && (
                              <Badge variant="outline">{plan.metadata.subject}</Badge>
                            )}
                            {plan.metadata?.grade_level && (
                              <Badge variant="outline">{plan.metadata.grade_level}</Badge>
                            )}
                            {plan.metadata?.duration && (
                              <Badge variant="outline">{plan.metadata.duration} min</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-2">
                            Created {new Date(plan.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Button variant="outline" size="sm">
                          <Save className="h-4 w-4 mr-2" />
                          View
                        </Button>
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

export default TeacherLessonPlanner;
