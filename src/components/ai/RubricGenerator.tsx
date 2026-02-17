import { useState } from "react";
import { useRouter } from "next/router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAIStudio } from "@/hooks/useAIStudio";
import { ListChecks, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RubricGeneratorProps {
  onContentGenerated?: () => void;
}

const RubricGenerator = ({ onContentGenerated }: RubricGeneratorProps) => {
  const router = useRouter();
  const { createRubric, loading } = useAIStudio();
  const { toast } = useToast();
  const [assignmentDescription, setAssignmentDescription] = useState("");

  const handleGenerate = async () => {
    if (!assignmentDescription.trim()) {
      toast({
        title: "Error",
        description: "Please enter an assignment description",
        variant: "destructive",
      });
      return;
    }

    const response = await createRubric(assignmentDescription);

    if (response?.success && response.content) {
      const savedContent = (response as { savedContent?: { id: string } }).savedContent;
      toast({
        title: "Success",
        description: "Rubric generated successfully. Opening output...",
      });
      onContentGenerated?.();
      if (savedContent?.id) {
        router.push(`/dashboard/teacher/ai-studio/output/${savedContent.id}`);
      }
    } else {
      toast({
        title: "Error",
        description: (response as { error?: string })?.error || "Failed to generate rubric",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Rubric Generator</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Enter your assignment description below. The generated rubric will open on a separate page where you can edit, regenerate criteria, and export to PDF.
        </p>

        <div className="space-y-4">
          <div>
            <Label htmlFor="assignment">Assignment Description *</Label>
            <Textarea
              id="assignment"
              value={assignmentDescription}
              onChange={(e) => setAssignmentDescription(e.target.value)}
              placeholder="Describe the assignment, objectives, requirements, and what students should demonstrate..."
              rows={10}
            />
          </div>

          <Button onClick={handleGenerate} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Rubric...
              </>
            ) : (
              <>
                <ListChecks className="h-4 w-4 mr-2" />
                Generate Rubric
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default RubricGenerator;
