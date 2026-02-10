import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { FileDown, ClipboardList, ListChecks, Trophy, ChevronRight } from "lucide-react";
import type { StudentRecord, QuizGrade } from "@/hooks/useTeacherStudentRecords";

const formatPct = (v: number | null) =>
  v != null ? `${Math.round(v)}%` : "—";

function getScoreValue(g: QuizGrade) {
  return g.score ?? (g.points_possible && g.points_earned != null
    ? (g.points_earned / g.points_possible) * 100
    : null);
}

function groupQuizzesByQuizId(quizGrades: QuizGrade[]) {
  const byQuiz = new Map<string, QuizGrade[]>();
  quizGrades.forEach((g) => {
    const list = byQuiz.get(g.quiz_id) ?? [];
    list.push(g);
    byQuiz.set(g.quiz_id, list);
  });
  return [...byQuiz.entries()];
}

export interface StudentRecordViewProps {
  student: StudentRecord;
  onExportPDF?: (student: StudentRecord) => void;
}

export function StudentRecordView({ student, onExportPDF }: StudentRecordViewProps) {
  const quizGroups = groupQuizzesByQuizId(student.quizGrades);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Card className="border-muted/60">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Assignments avg.</p>
              <p className="font-semibold">{formatPct(student.assignmentAvg)}</p>
            </CardContent>
          </Card>
          <Card className="border-muted/60">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Quizzes avg.</p>
              <p className="font-semibold">{formatPct(student.quizAvg)}</p>
            </CardContent>
          </Card>
          <Card className="border-muted/60">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Overall</p>
              <p className="font-semibold">{formatPct(student.overallAvg)}</p>
            </CardContent>
          </Card>
          <Card className="border-muted/60">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Graded</p>
              <p className="font-semibold">
                {student.gradedAssignments}/{student.totalAssignments} ·{" "}
                {student.gradedQuizzes}/{student.totalQuizzes}
              </p>
            </CardContent>
          </Card>
        </div>

        {onExportPDF && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onExportPDF(student)}>
              <FileDown className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              Assignments
            </h3>
            <p className="text-xs text-muted-foreground">
              {student.assignmentGrades.length} total
            </p>
          </div>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Title</TableHead>
                  <TableHead className="text-right">Grade</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {student.assignmentGrades.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground">
                      No assignments in this class.
                    </TableCell>
                  </TableRow>
                ) : (
                  student.assignmentGrades.map((g) => {
                    const pct =
                      g.grade != null && (g.points_possible ?? null) != null && (g.points_possible ?? 0) > 0
                        ? Math.round((g.grade / (g.points_possible ?? 1)) * 100)
                        : null;
                    const gradeLabel =
                      g.grade != null
                        ? `${g.grade}${g.points_possible != null ? `/${g.points_possible}` : ""}${pct != null ? ` (${pct}%)` : ""}`
                        : "—";
                    return (
                      <TableRow key={g.assignment_id}>
                        <TableCell className="max-w-[360px] truncate" title={g.title}>
                          {g.title}
                        </TableCell>
                        <TableCell className="text-right font-mono whitespace-nowrap">
                          {gradeLabel}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <span className="text-xs text-muted-foreground">
                            {g.status === "not_submitted" ? "Not submitted" : g.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <ListChecks className="w-4 h-4" />
              Quizzes
            </h3>
            <p className="text-xs text-muted-foreground">
              {student.quizGrades.length} attempt(s) across {quizGroups.length} quiz(zes)
            </p>
          </div>
          <div className="rounded-md border overflow-hidden space-y-0">
            {student.quizGrades.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground border-b last:border-b-0">
                No quiz attempts yet.
              </div>
            ) : (
              quizGroups.map(([quizId, attempts]) => {
                const title = attempts[0]?.title ?? "Quiz";
                const bestValue = Math.max(
                  ...attempts
                    .map((a) => getScoreValue(a))
                    .filter((v): v is number => v != null),
                  -1
                );
                return (
                  <Collapsible key={quizId} defaultOpen={false} className="group">
                    <div className="border-b last:border-b-0">
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 bg-muted/40 px-3 py-2 font-medium text-sm truncate text-left hover:bg-muted/60 transition-colors"
                          title={title}
                        >
                          <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
                          <span className="truncate">{title}</span>
                          <span className="ml-auto text-muted-foreground text-xs shrink-0">
                            {attempts.length} attempt{attempts.length !== 1 ? "s" : ""}
                          </span>
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                              <TableHead className="w-[100px]">Attempt</TableHead>
                              <TableHead className="text-right">Score</TableHead>
                              <TableHead className="w-[80px] text-right" />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {attempts
                              .sort((a, b) => a.attempt_number - b.attempt_number)
                              .map((g) => {
                                const value = getScoreValue(g);
                                const isBest =
                                  value != null && value >= 0 && value === bestValue && bestValue > -1;
                                return (
                                  <TableRow
                                    key={`${g.quiz_id}-${g.attempt_number}`}
                                    className={isBest ? "bg-primary/5" : undefined}
                                  >
                                    <TableCell className="font-mono">#{g.attempt_number}</TableCell>
                                    <TableCell className="text-right font-mono whitespace-nowrap">
                                      {g.score != null
                                        ? `${Math.round(g.score)}%`
                                        : g.points_earned != null
                                          ? `${g.points_earned}/${g.points_possible ?? "?"}`
                                          : "—"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {isBest ? (
                                        <Badge
                                          variant="secondary"
                                          className="gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-400"
                                        >
                                          <Trophy className="w-3 h-3" />
                                          Best
                                        </Badge>
                                      ) : null}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                          </TableBody>
                        </Table>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
