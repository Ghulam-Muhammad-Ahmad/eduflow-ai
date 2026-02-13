import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAIStudio } from "@/hooks/useAIStudio";
import { TrendingUp, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DifferentiationAssistantProps {
  onContentGenerated?: () => void;
}

const DifferentiationAssistant = ({ onContentGenerated }: DifferentiationAssistantProps) => {
  const { differentiateContent, loading } = useAIStudio();
  const { toast } = useToast();
  const [originalContent, setOriginalContent] = useState("");
  const [targetLevel, setTargetLevel] = useState<"below_grade" | "at_grade" | "above_grade">("at_grade");
  const [subject, setSubject] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [result, setResult] = useState<string>("");

  const handleDifferentiate = async () => {
    if (!originalContent.trim()) {
      toast({
        title: "Error",
        description: "Please enter content to differentiate",
        variant: "destructive",
      });
      return;
    }

    if (!subject || !gradeLevel) {
      toast({
        title: "Error",
        description: "Please select subject and grade level",
        variant: "destructive",
      });
      return;
    }

    const response = await differentiateContent(
      originalContent,
      targetLevel,
      subject,
      gradeLevel
    );

    if (response?.success) {
      setResult(response.content);
      toast({
        title: "Success",
        description: "Content differentiated successfully",
      });
      onContentGenerated?.();
    } else {
      toast({
        title: "Error",
        description: response?.error || "Failed to differentiate content",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Differentiation Assistant</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Modify content for different learning levels while maintaining core concepts
        </p>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="original">Original Content *</Label>
            <Textarea
              id="original"
              value={originalContent}
              onChange={(e) => setOriginalContent(e.target.value)}
              placeholder="Paste the original content here..."
              rows={8}
            />
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label>Target Level</Label>
              <Select value={targetLevel} onValueChange={(v: "below_grade" | "at_grade" | "above_grade") => setTargetLevel(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="below_grade">Below Grade Level</SelectItem>
                  <SelectItem value="at_grade">At Grade Level</SelectItem>
                  <SelectItem value="above_grade">Above Grade Level</SelectItem>
                </SelectContent>
              </Select>
            </div>
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

          <Button onClick={handleDifferentiate} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Differentiating...
              </>
            ) : (
              <>
                <TrendingUp className="h-4 w-4 mr-2" />
                Differentiate Content
              </>
            )}
          </Button>
        </div>
      </Card>

      {result && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Differentiated Content</h3>
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

export default DifferentiationAssistant;
