import { useState, useMemo } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  useMyEvaluationTest,
  useStartEvaluation,
  useSubmitAnswers,
} from "@/hooks/useTeacherEvaluation";
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  BarChart3,
  Brain,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";

const RECOMMENDATION_CONFIG = {
  approved: { label: "Approved", variant: "default" as const, color: "text-green-600" },
  needs_review: { label: "Needs Review", variant: "secondary" as const, color: "text-yellow-600" },
  rejected: { label: "Not Approved", variant: "destructive" as const, color: "text-red-600" },
};

const SCORE_CATEGORIES = [
  { key: "subject_scores", label: "Subject Knowledge" },
  { key: "teaching_style_scores", label: "Teaching Style" },
  { key: "personality_scores", label: "Personality" },
  { key: "student_fit_scores", label: "Student Fit" },
];

function formatScoreKey(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? "bg-green-500" : value >= 50 ? "bg-yellow-500" : "bg-red-400";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export default function TeacherEvaluation() {
  const { data, isLoading } = useMyEvaluationTest();
  const startEvaluation = useStartEvaluation();
  const submitAnswers = useSubmitAnswers();
  const { toast } = useToast();

  const [currentSection, setCurrentSection] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const test = data?.test ?? null;
  const profile = data?.profile ?? null;
  const sections = test?.questions_json?.sections ?? [];

  const allQuestions = useMemo(() => sections.flatMap((s) => s.questions), [sections]);
  const answered = Object.keys(answers).length;
  const total = allQuestions.length;

  const handleStart = async () => {
    if (!test) return;
    try {
      await startEvaluation.mutateAsync(test.id);
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handleSubmit = async () => {
    if (!test) return;
    if (answered < total) {
      toast({ title: "Answer all questions before submitting", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await submitAnswers.mutateAsync({ evaluation_test_id: test.id, answers_json: answers });
      toast({ title: "Evaluation submitted! AI is processing your results." });
    } catch (err) {
      toast({ title: "Submission failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Spinner />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Tutor Evaluation</h1>
          <p className="text-muted-foreground mt-1">
            Complete your AI-powered evaluation to build your tutor profile.
          </p>
        </div>

        {/* No test assigned */}
        {!test && (
          <Card>
            <CardContent className="flex flex-col items-center py-16 gap-4">
              <ClipboardList className="w-12 h-12 text-muted-foreground" />
              <p className="text-lg font-medium">No evaluation assigned yet</p>
              <p className="text-muted-foreground text-sm text-center max-w-sm">
                Your workspace owner will assign an evaluation test. Check back soon.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Pending: ready to start */}
        {test?.status === "pending" && test.questions_json && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5" />
                {test.questions_json.test_title || "Tutor Evaluation Test"}
              </CardTitle>
              <CardDescription>
                Subject: <strong>{test.subject}</strong> &middot; Grades:{" "}
                <strong>{test.grades.join(", ")}</strong> &middot; Curriculum:{" "}
                <strong>{test.curriculum.join(", ")}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                <span>{total} questions</span>
                <span>&middot;</span>
                <span>{sections.length} sections</span>
              </div>
              <ul className="space-y-1 text-sm">
                {sections.map((s) => (
                  <li key={s.section_name} className="flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    <span>
                      <strong>{s.section_name}</strong> &mdash; {s.purpose}
                    </span>
                  </li>
                ))}
              </ul>
              <Button onClick={handleStart} disabled={startEvaluation.isPending} className="w-full sm:w-auto">
                {startEvaluation.isPending ? <Spinner className="mr-2 h-4 w-4" /> : null}
                Start Evaluation
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Generating questions */}
        {test?.status === "pending" && !test.questions_json && (
          <Card>
            <CardContent className="flex flex-col items-center py-16 gap-4">
              <Spinner />
              <p className="text-muted-foreground">AI is generating your evaluation questions…</p>
            </CardContent>
          </Card>
        )}

        {/* In progress: show questions */}
        {test?.status === "in_progress" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {answered} / {total} answered
              </p>
              <Badge variant="secondary">
                Section {currentSection + 1} of {sections.length}
              </Badge>
            </div>
            <Progress value={(answered / Math.max(total, 1)) * 100} />

            {sections[currentSection] && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{sections[currentSection].section_name}</CardTitle>
                  <CardDescription>{sections[currentSection].purpose}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                  {sections[currentSection].questions.map((q, qi) => (
                    <div key={q.question_id} className="space-y-3">
                      <p className="font-medium text-sm">
                        Q{qi + 1}. {q.question}
                      </p>
                      {q.question_type === "mcq" && q.options.length > 0 ? (
                        <RadioGroup
                          value={answers[q.question_id] ?? ""}
                          onValueChange={(val) =>
                            setAnswers((prev) => ({ ...prev, [q.question_id]: val }))
                          }
                        >
                          {q.options.map((opt, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              <RadioGroupItem value={opt} id={`${q.question_id}-${oi}`} />
                              <Label htmlFor={`${q.question_id}-${oi}`} className="font-normal">
                                {opt}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      ) : (
                        <Textarea
                          placeholder="Your answer..."
                          value={answers[q.question_id] ?? ""}
                          onChange={(e) =>
                            setAnswers((prev) => ({ ...prev, [q.question_id]: e.target.value }))
                          }
                          rows={3}
                        />
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setCurrentSection((s) => Math.max(0, s - 1))}
                disabled={currentSection === 0}
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Previous
              </Button>
              {currentSection < sections.length - 1 ? (
                <Button onClick={() => setCurrentSection((s) => s + 1)}>
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={submitting || answered < total}>
                  {submitting ? <Spinner className="mr-2 h-4 w-4" /> : null}
                  Submit Evaluation
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Completed: awaiting AI */}
        {test?.status === "completed" && (
          <Card>
            <CardContent className="flex flex-col items-center py-16 gap-4">
              <Clock className="w-12 h-12 text-muted-foreground animate-pulse" />
              <p className="text-lg font-medium">Answers submitted</p>
              <p className="text-muted-foreground text-sm">AI is evaluating your responses. Refresh shortly.</p>
            </CardContent>
          </Card>
        )}

        {/* Evaluated: show scores */}
        {test?.status === "evaluated" && profile && (
          <div className="space-y-6">
            <Card>
              <CardContent className="pt-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                    <div>
                      <p className="text-2xl font-bold">{profile.overall_score}/100</p>
                      <p className="text-muted-foreground text-sm">Overall Score</p>
                    </div>
                  </div>
                </div>
                <Badge variant={RECOMMENDATION_CONFIG[profile.recommendation]?.variant ?? "secondary"}>
                  {RECOMMENDATION_CONFIG[profile.recommendation]?.label ?? profile.recommendation}
                </Badge>
              </CardContent>
            </Card>

            {profile.summary && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Brain className="w-4 h-4" /> AI Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{profile.summary}</p>
                </CardContent>
              </Card>
            )}

            {SCORE_CATEGORIES.map(({ key, label }) => {
              const scores = profile[key as keyof typeof profile] as Record<string, number> | undefined;
              if (!scores || Object.keys(scores).length === 0) return null;
              return (
                <Card key={key}>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" /> {label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {Object.entries(scores).map(([k, v]) => (
                      <ScoreBar key={k} label={formatScoreKey(k)} value={v} />
                    ))}
                  </CardContent>
                </Card>
              );
            })}

            {(profile.strengths?.length > 0 || profile.weaknesses?.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {profile.strengths?.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm text-green-600">Strengths</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-1">
                        {profile.strengths.map((s, i) => (
                          <li key={i} className="text-sm flex gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
                {profile.weaknesses?.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm text-red-600">Areas to Improve</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-1">
                        {profile.weaknesses.map((w, i) => (
                          <li key={i} className="text-sm flex gap-2">
                            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                            {w}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {profile.best_for?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Best For</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {profile.best_for.map((b, i) => (
                    <Badge key={i} variant="secondary">{b}</Badge>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
