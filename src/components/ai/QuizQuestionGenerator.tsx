import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { HelpCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface QuizQuestionGeneratorProps {
  onContentGenerated?: () => void;
}

const QuizQuestionGenerator = ({ onContentGenerated }: QuizQuestionGeneratorProps) => {
  const { createQuizQuestions, loading } = useAIStudio();
  const { toast } = useToast();
  const [sourceMaterial, setSourceMaterial] = useState("");
  const [numQuestions, setNumQuestions] = useState(5);
  const [questionType, setQuestionType] = useState<"multiple_choice" | "true_false" | "short_answer">("multiple_choice");
  const [result, setResult] = useState<string>("");

  const handleGenerate = async () => {
    if (!sourceMaterial.trim()) {
      toast({
        title: "Error",
        description: "Please enter source material",
        variant: "destructive",
      });
      return;
    }

    const response = await createQuizQuestions(
      sourceMaterial,
      numQuestions,
      questionType
    );

    if (response?.success) {
      setResult(response.content);
      toast({
        title: "Success",
        description: "Quiz questions generated successfully",
      });
      onContentGenerated?.();
    } else {
      toast({
        title: "Error",
        description: response?.error || "Failed to generate quiz questions",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Quiz Question Generator</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Generate quiz questions from source material or documents
        </p>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="source">Source Material *</Label>
            <Textarea
              id="source"
              value={sourceMaterial}
              onChange={(e) => setSourceMaterial(e.target.value)}
              placeholder="Paste the source material, text from documents, or learning content here..."
              rows={10}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
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
            <div>
              <Label>Question Type</Label>
              <Select value={questionType} onValueChange={(v: "multiple_choice" | "true_false" | "short_answer") => setQuestionType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                  <SelectItem value="true_false">True/False</SelectItem>
                  <SelectItem value="short_answer">Short Answer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleGenerate} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Questions...
              </>
            ) : (
              <>
                <HelpCircle className="h-4 w-4 mr-2" />
                Generate Questions
              </>
            )}
          </Button>
        </div>
      </Card>

      {result && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Generated Questions</h3>
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

export default QuizQuestionGenerator;
