import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { StudentRecord, AssignmentGrade, QuizGrade } from "@/hooks/useTeacherStudentRecords";
import { format } from "date-fns";

const FONT_SIZE = 10;
const HEADER_COLOR: [number, number, number] = [99, 102, 241]; // medium-slate-blue-ish
const ROW_ALT: [number, number, number] = [248, 250, 252];

function addHeader(doc: jsPDF, title: string, subtitle?: string) {
  doc.setFontSize(18);
  doc.setTextColor(30, 41, 59);
  doc.text(title, 14, 22);
  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(subtitle, 14, 30);
  }
  doc.setDrawColor(226, 232, 240);
  doc.line(14, 35, doc.getPageWidth() - 14, 35);
}

function formatGrade(grade: number | null, pointsPossible: number | null): string {
  if (grade == null) return "—";
  const possible = pointsPossible ?? 100;
  if (possible <= 0) return String(grade);
  const pct = Math.round((grade / possible) * 100);
  return `${grade}/${possible} (${pct}%)`;
}

function formatQuizScore(score: number | null, pointsEarned: number | null, pointsPossible: number | null): string {
  if (score != null) return `${Math.round(score)}%`;
  if (pointsEarned != null && pointsPossible != null)
    return `${pointsEarned}/${pointsPossible}`;
  return "—";
}

/**
 * Generate a PDF report for the entire classroom (all students and their grades).
 */
export function generateClassroomPDF(
  classroomName: string,
  students: StudentRecord[],
  generatedAt: string
): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  addHeader(
    doc,
    `Grade Report: ${classroomName}`,
    `Generated on ${generatedAt} • ${students.length} student(s)`
  );

  const head = [["Student", "Assignments avg.", "Quizzes avg.", "Overall avg.", "Graded (A/Q)", "Joined"]];
  const rows = students.map((s) => [
    (s.display_name || "Unknown") + (s.email ? ` (${s.email})` : ""),
    s.assignmentAvg != null ? `${Math.round(s.assignmentAvg)}%` : "—",
    s.quizAvg != null ? `${Math.round(s.quizAvg)}%` : "—",
    s.overallAvg != null ? `${Math.round(s.overallAvg)}%` : "—",
    `${s.gradedAssignments}/${s.totalAssignments} · ${s.gradedQuizzes}/${s.totalQuizzes}`,
    format(new Date(s.joined_at), "MMM d, yyyy"),
  ]);

  autoTable(doc, {
    startY: 42,
    head,
    body: rows,
    theme: "striped",
    headStyles: { fillColor: HEADER_COLOR, textColor: 255 },
    alternateRowStyles: { fillColor: ROW_ALT },
    margin: { left: 14, right: 14 },
    tableLineColor: [226, 232, 240],
    tableLineWidth: 0.1,
  });

  const finalY = (doc as any).lastAutoTable?.finalY ?? 50;
  if (finalY > doc.getPageHeight() - 25) {
    doc.addPage([doc.getPageWidth(), doc.getPageHeight()], "landscape");
  }

  // Per-student detail tables (condensed)
  let startY = finalY + 15;
  students.forEach((s, idx) => {
    if (startY > doc.getPageHeight() - 60) {
      doc.addPage([doc.getPageWidth(), doc.getPageHeight()], "landscape");
      startY = 20;
    }
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text(`${s.display_name || "Student"} — Assignments & Quizzes`, 14, startY);
    startY += 8;

    const aHead = [["Assignment", "Grade", "Status", "Submitted"]];
    const aRows: string[][] = s.assignmentGrades.map((g) => [
      g.title,
      formatGrade(g.grade, g.points_possible),
      g.status,
      g.submitted_at ? format(new Date(g.submitted_at), "MMM d, yyyy") : "—",
    ]);
    if (aRows.length === 0) aRows.push(["No assignments", "—", "—", "—"]);

    autoTable(doc, {
      startY,
      head: aHead,
      body: aRows,
      theme: "plain",
      headStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85] },
      margin: { left: 14 },
      tableLineColor: [226, 232, 240],
      tableLineWidth: 0.1,
    });
    startY = (doc as any).lastAutoTable?.finalY + 6;

    const qHead = [["Quiz", "Score", "Attempt", "Submitted"]];
    const qRows: string[][] = s.quizGrades.map((g) => [
      g.title,
      formatQuizScore(g.score, g.points_earned, g.points_possible),
      String(g.attempt_number),
      g.submitted_at ? format(new Date(g.submitted_at), "MMM d, yyyy") : "—",
    ]);
    if (qRows.length === 0) qRows.push(["No quiz attempts", "—", "—", "—"]);

    autoTable(doc, {
      startY,
      head: qHead,
      body: qRows,
      theme: "plain",
      headStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85] },
      margin: { left: 14 },
      tableLineColor: [226, 232, 240],
      tableLineWidth: 0.1,
    });
    startY = (doc as any).lastAutoTable?.finalY + 12;
  });

  return doc;
}

/**
 * Generate a PDF report for a single student (full assignment and quiz breakdown).
 */
export function generateStudentPDF(
  student: StudentRecord,
  generatedAt: string
): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const name = student.display_name || "Student";
  addHeader(
    doc,
    `Student Report: ${name}`,
    `${student.classroom_name} • Generated on ${generatedAt}`
  );

  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text(`Email: ${student.email || "—"}`, 14, 42);
  doc.text(`Joined: ${format(new Date(student.joined_at), "MMMM d, yyyy")}`, 14, 48);
  doc.text(
    `Overall average: ${student.overallAvg != null ? `${Math.round(student.overallAvg)}%` : "—"} (Assignments: ${student.assignmentAvg != null ? `${Math.round(student.assignmentAvg)}%` : "—"} | Quizzes: ${student.quizAvg != null ? `${Math.round(student.quizAvg)}%` : "—"})`,
    14,
    54
  );

  let startY = 64;

  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text("Assignments", 14, startY);
  startY += 8;

  const aHead = [["Assignment", "Grade", "Status", "Submitted", "Graded"]];
  const aRows: string[][] = student.assignmentGrades.map((g) => [
    g.title,
    formatGrade(g.grade, g.points_possible),
    g.status,
    g.submitted_at ? format(new Date(g.submitted_at), "MMM d, yyyy") : "—",
    g.graded_at ? format(new Date(g.graded_at), "MMM d, yyyy") : "—",
  ]);
  if (aRows.length === 0) aRows.push(["No assignments in this class", "—", "—", "—", "—"]);

  autoTable(doc, {
    startY,
    head: aHead,
    body: aRows,
    theme: "striped",
    headStyles: { fillColor: HEADER_COLOR, textColor: 255 },
    alternateRowStyles: { fillColor: ROW_ALT },
    margin: { left: 14, right: 14 },
    tableLineColor: [226, 232, 240],
    tableLineWidth: 0.1,
  });
  startY = (doc as any).lastAutoTable?.finalY + 14;

  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text("Quizzes", 14, startY);
  startY += 8;

  const qHead = [["Quiz", "Score", "Points", "Attempt", "Submitted"]];
  const qRows: string[][] = student.quizGrades.map((g) => [
    g.title,
    formatQuizScore(g.score, g.points_earned, g.points_possible),
    g.points_earned != null && g.points_possible != null
      ? `${g.points_earned}/${g.points_possible}`
      : "—",
    String(g.attempt_number),
    g.submitted_at ? format(new Date(g.submitted_at), "MMM d, yyyy") : "—",
  ]);
  if (qRows.length === 0) qRows.push(["No quiz attempts", "—", "—", "—", "—"]);

  autoTable(doc, {
    startY,
    head: qHead,
    body: qRows,
    theme: "striped",
    headStyles: { fillColor: HEADER_COLOR, textColor: 255 },
    alternateRowStyles: { fillColor: ROW_ALT },
    margin: { left: 14, right: 14 },
    tableLineColor: [226, 232, 240],
    tableLineWidth: 0.1,
  });

  return doc;
}
