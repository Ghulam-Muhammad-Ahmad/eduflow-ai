"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useAIStudio } from "@/hooks/useAIStudio";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Loader2, FileText, ListTodo, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuizQuestion } from "@/hooks/useQuizzes";
import { v4 as uuidv4 } from "uuid";

export type QuestionTypeOption = "multiple_choice" | "true_false" | "short_answer";

const QUESTION_TYPES: { value: QuestionTypeOption; label: string; icon: React.ReactNode }[] = [
  { value: "multiple_choice", label: "Multiple Choice", icon: <ListTodo className="h-5 w-5" /> },
  { value: "true_false", label: "True / False", icon: <MessageSquare className="h-5 w-5" /> },
  { value: "short_answer", label: "Short Answer", icon: <FileText className="h-5 w-5" /> },
];

interface AIGenerateQuestionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onQuestionsGenerated: (questions: QuizQuestion[]) => void;
}

export function AIGenerateQuestionsDialog({
  open,
  onOpenChange,
  onQuestionsGenerated,
}: AIGenerateQuestionsDialogProps) {
  const { createQuizQuestions, loading } = useAIStudio();
  const { toast } = useToast();
  const [sourceMaterial, setSourceMaterial] = useState("");
  const [numQuestions, setNumQuestions] = useState(5);
  const [questionType, setQuestionType] = useState<QuestionTypeOption>("multiple_choice");

  const handleGenerate = async () => {
    if (!sourceMaterial.trim()) return;

    const result = await createQuizQuestions(sourceMaterial, numQuestions, questionType);

    if (!result?.success) {
      toast({
        title: "Generation failed",
        description: result?.error || "Could not generate questions. Try again.",
        variant: "destructive",
      });
      return;
    }

    try {
        const jsonMatch = result.content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          interface ParsedOption { text?: string; is_correct?: boolean }
          interface ParsedQuestion { question_text?: string; question?: string; options?: (string | ParsedOption)[]; correct_answer?: string; answer?: string; explanation?: string }
          const newQuestions: QuizQuestion[] = parsed.map((q: ParsedQuestion, i: number) => {
            // Validate and ensure at least one option is marked as correct for multiple choice
            let options = undefined;
            let correctAnswer = undefined;
            
            if (questionType === "multiple_choice" && q.options && Array.isArray(q.options)) {
              // Ensure options have correct structure
              options = q.options.map((opt: string | ParsedOption) => ({
                id: uuidv4(),
                text: typeof opt === "string" ? opt : opt.text || opt,
                is_correct: typeof opt === "string" ? false : (opt.is_correct ?? false),
              }));
              
              // Check if at least one option is marked as correct
              const hasCorrectAnswer = options.some((opt: { is_correct: boolean }) => opt.is_correct);
              if (!hasCorrectAnswer && options.length > 0) {
                // If no option is marked as correct, mark the first one (shouldn't happen with proper AI prompt)
                console.warn(`Question "${q.question_text}" had no correct answer marked. Marking first option as correct.`);
                options[0].is_correct = true;
              }
            }
            
            if (questionType !== "multiple_choice") {
              correctAnswer = q.correct_answer || q.answer || "";
            }
            
            return {
              question_type: questionType,
              question_text: q.question_text || q.question || "",
              points: 1,
              order_index: i,
              options,
              correct_answer: correctAnswer,
              explanation: q.explanation || "",
            };
          });
          
          onQuestionsGenerated(newQuestions);
          onOpenChange(false);
          setSourceMaterial("");
        } else {
          toast({
            title: "AI output could not be parsed",
            description:
              "We could not parse the AI response. You can insert a single fallback question and edit it.",
            variant: "destructive",
          });

          const shouldInsertFallback = window.confirm(
            "AI output could not be parsed. Insert a fallback question so you can edit it?"
          );

          if (!shouldInsertFallback) {
            return;
          }

          const fallback: QuizQuestion = {
            question_type: questionType,
            question_text: result.content.substring(0, 300),
            points: 1,
            order_index: 0,
          };
          onQuestionsGenerated([fallback]);
          onOpenChange(false);
        }
    } catch (error) {
      console.error("Error parsing quiz questions:", error);
      toast({
        title: "AI output could not be parsed",
        description:
          "We could not parse the AI response. You can insert a single fallback question and edit it.",
        variant: "destructive",
      });
      const fallback: QuizQuestion = {
        question_type: questionType,
        question_text: result.content.substring(0, 300),
        points: 1,
        order_index: 0,
      };
      onQuestionsGenerated([fallback]);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            Generate questions with AI
          </DialogTitle>
          <DialogDescription>
            Paste your content, lecture notes, or topic below. AI will create questions you can edit before adding to the quiz.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="source">Source material or topic</Label>
            <Textarea
              id="source"
              value={sourceMaterial}
              onChange={(e) => setSourceMaterial(e.target.value)}
              placeholder="Paste lecture notes, textbook excerpt, or describe the topic..."
              rows={5}
              className="resize-none"
            />
          </div>

          <div className="space-y-3">
            <div className="flex justify-between">
              <Label>Number of questions</Label>
              <span className="text-sm font-medium text-muted-foreground">{numQuestions}</span>
            </div>
            <Slider
              value={[numQuestions]}
              onValueChange={([v]) => setNumQuestions(v)}
              min={1}
              max={20}
              step={1}
            />
          </div>

          <div className="space-y-2">
            <Label>Question type</Label>
            <div className="grid grid-cols-3 gap-2">
              {QUESTION_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setQuestionType(type.value)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all",
                    questionType === type.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  )}
                >
                  {type.icon}
                  {type.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={loading || !sourceMaterial.trim()}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate questions
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
