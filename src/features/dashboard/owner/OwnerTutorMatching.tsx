import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  useStudentRequirements,
  useRunMatching,
  type MatchResult,
} from "@/hooks/useTutorMatching";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import {
  Users,
  Sparkles,
  Trophy,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Info,
} from "lucide-react";

type MatchResultFull = MatchResult;
type EmptyResult = { matches: []; reason: string; message: string };

function RankedTutorCard({
  match,
  rank,
  tutor,
}: {
  match: MatchResultFull["ranked_matches"][0] & { possible_risks?: string[]; owner_note?: string };
  rank: number;
  tutor?: { display_name?: string; email?: string; avatar_url?: string };
}) {
  return (
    <Card className={rank === 1 ? "border-primary shadow-sm" : ""}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {rank === 1 && <Trophy className="w-5 h-5 text-yellow-500" />}
            <div>
              <p className="font-medium">
                {tutor?.display_name ?? `Tutor ${rank}`}
              </p>
              {tutor?.email && (
                <p className="text-xs text-muted-foreground">{tutor.email}</p>
              )}
            </div>
          </div>
          <Badge variant={rank === 1 ? "default" : "secondary"}>
            {Math.round(match.match_score)}% match
          </Badge>
        </div>

        <Progress value={match.match_score} className="h-2" />

        {match.reason?.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Why this tutor fits:</p>
            <ul className="space-y-0.5">
              {match.reason.map((r, i) => (
                <li key={i} className="text-xs flex gap-2">
                  <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0 mt-0.5" />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}

        {match.possible_risks && match.possible_risks.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Possible risks:</p>
            <ul className="space-y-0.5">
              {match.possible_risks.map((r, i) => (
                <li key={i} className="text-xs flex gap-2">
                  <AlertTriangle className="w-3 h-3 text-yellow-500 shrink-0 mt-0.5" />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}

        {match.owner_note && (
          <div className="flex gap-2 p-2 bg-muted rounded text-xs">
            <Info className="w-3 h-3 shrink-0 mt-0.5 text-muted-foreground" />
            {match.owner_note}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function OwnerTutorMatching() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: requirements = [], isLoading: reqLoading } = useStudentRequirements();
  const runMatching = useRunMatching();
  const { tutors } = useOwnerWorkspace();

  const [selectedReqId, setSelectedReqId] = useState<string>("");
  const [result, setResult] = useState<MatchResultFull | EmptyResult | null>(null);

  // Pre-select from query param
  useEffect(() => {
    const qReq = router.query.requirement as string | undefined;
    if (qReq && !selectedReqId) {
      setSelectedReqId(qReq);
    }
  }, [router.query.requirement, selectedReqId]);

  const selectedReq = requirements.find((r) => r.id === selectedReqId);

  const handleRun = async () => {
    if (!selectedReqId) {
      toast({ title: "Select a student requirement first", variant: "destructive" });
      return;
    }
    try {
      const res = await runMatching.mutateAsync(selectedReqId);
      setResult(res);
    } catch (err) {
      toast({ title: "Matching failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  const isEmptyResult = (r: MatchResultFull | EmptyResult): r is EmptyResult =>
    "reason" in r && Array.isArray((r as EmptyResult).matches) && (r as EmptyResult).matches.length === 0;

  const rankedMatches = result && !isEmptyResult(result)
    ? (result as MatchResultFull).ranked_matches ?? []
    : [];

  const bestMatch = result && !isEmptyResult(result)
    ? (result as MatchResultFull).best_match
    : null;

  // Enrich ranked matches with tutor profiles
  const tutorMap = new Map(tutors.map((t) => [t.user_id, t]));

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Tutor Matching</h1>
          <p className="text-muted-foreground mt-1">
            AI-powered matching to find the best tutor for each student.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Step 1: Select Student Requirement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {reqLoading ? (
              <Spinner />
            ) : requirements.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No requirements found.{" "}
                <button
                  className="text-primary underline"
                  onClick={() => router.push("/dashboard/owner/student-requirements")}
                >
                  Create one first
                </button>
              </div>
            ) : (
              <Select value={selectedReqId} onValueChange={setSelectedReqId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a student requirement…" />
                </SelectTrigger>
                <SelectContent>
                  {requirements.map((req) => (
                    <SelectItem key={req.id} value={req.id}>
                      {req.student_name} — {req.subject}, Grade {req.grade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {selectedReq && (
              <div className="p-3 bg-muted rounded text-sm space-y-1">
                <p>
                  <strong>Subject:</strong> {selectedReq.subject} &middot;{" "}
                  <strong>Grade:</strong> {selectedReq.grade} &middot;{" "}
                  <strong>Curriculum:</strong> {selectedReq.curriculum}
                </p>
                {selectedReq.student_level && (
                  <p>
                    <strong>Level:</strong> {selectedReq.student_level}
                    {selectedReq.student_nature?.length > 0 &&
                      ` &middot; Nature: ${selectedReq.student_nature.join(", ")}`}
                  </p>
                )}
                {selectedReq.goal && (
                  <p>
                    <strong>Goal:</strong> {selectedReq.goal}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={handleRun}
            disabled={!selectedReqId || runMatching.isPending}
            className="gap-2"
          >
            {runMatching.isPending ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Run AI Matching
          </Button>
        </div>

        {result && (
          <>
            {isEmptyResult(result) ? (
              <Card>
                <CardContent className="flex flex-col items-center py-12 gap-4">
                  <Users className="w-12 h-12 text-muted-foreground" />
                  <p className="text-lg font-medium">No approved tutors available</p>
                  <p className="text-muted-foreground text-sm text-center max-w-sm">
                    {result.message}
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => router.push("/dashboard/owner/tutors")}
                  >
                    Go to Tutors <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-lg">Matching Results</h2>
                  <Badge variant="secondary">{rankedMatches.length} candidates ranked</Badge>
                </div>

                {rankedMatches.map((match, i) => {
                  const isBest = bestMatch?.teacher_id === match.teacher_id;
                  const enriched = isBest
                    ? {
                        ...match,
                        possible_risks: bestMatch?.possible_risks ?? [],
                        owner_note: bestMatch?.owner_note ?? "",
                        match_score: bestMatch?.match_score ?? match.match_score,
                      }
                    : match;
                  const tutor = tutorMap.get(match.teacher_id);
                  return (
                    <RankedTutorCard
                      key={match.teacher_id}
                      match={enriched}
                      rank={i + 1}
                      tutor={tutor ? {
                        display_name: (tutor as unknown as { display_name?: string }).display_name,
                        email: (tutor as unknown as { email?: string }).email,
                      } : undefined}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
