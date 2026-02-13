import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAIStudio } from "@/hooks/useAIStudio";
import { FileText, Lightbulb, MessageSquare, Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ContentGeneratorProps {
  onContentGenerated?: () => void;
}

const ContentGenerator = ({ onContentGenerated }: ContentGeneratorProps) => {
  const { generateWorksheet, generateDiscussionQuestions, generateProjectIdeas, loading } = useAIStudio();
  const { toast } = useToast();
  const [contentType, setContentType] = useState<"worksheet" | "discussion" | "project">("worksheet");
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [numQuestions, setNumQuestions] = useState(5);
  const [result, setResult] = useState<string>("");

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast({
        title: "Error",
        description: "Please enter a topic",
        variant: "destructive",
      });
      return;
    }

    let response;
    if (contentType === "worksheet") {
      if (!subject || !gradeLevel) {
        toast({
          title: "Error",
          description: "Please select subject and grade level",
          variant: "destructive",
        });
        return;
      }
      response = await generateWorksheet(topic, gradeLevel, subject);
    } else if (contentType === "discussion") {
      response = await generateDiscussionQuestions(topic, numQuestions);
    } else {
      if (!subject || !gradeLevel) {
        toast({
          title: "Error",
          description: "Please select subject and grade level",
          variant: "destructive",
        });
        return;
      }
      response = await generateProjectIdeas(subject, gradeLevel, topic);
    }

    if (response?.success) {
      setResult(response.content);
      toast({
        title: "Success",
        description: "Content generated successfully",
      });
      onContentGenerated?.();
    } else {
      toast({
        title: "Error",
        description: response?.error || "Failed to generate content",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Generate Content</h2>
        
        <div className="space-y-4">
          <div>
            <Label>Content Type</Label>
            <Select value={contentType} onValueChange={(v: "worksheet" | "discussion" | "project") => setContentType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="worksheet">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Worksheet
                  </div>
                </SelectItem>
                <SelectItem value="discussion">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Discussion Questions
                  </div>
                </SelectItem>
                <SelectItem value="project">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4" />
                    Project Ideas
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
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

          {contentType !== "discussion" && (
            <>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Subject</Label>
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
                  <Label>Grade Level</Label>
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
              </div>
            </>
          )}

          {contentType === "discussion" && (
            <div>
              <Label htmlFor="numQuestions">Number of Questions</Label>
              <Input
                id="numQuestions"
                type="number"
                min="1"
                max="20"
                value={numQuestions}
                onChange={(e) => setNumQuestions(parseInt(e.target.value) || 5)}
              />
            </div>
          )}

          <Button onClick={handleGenerate} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Content
              </>
            )}
          </Button>
        </div>
      </Card>

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
    </div>
  );
};

export default ContentGenerator;
