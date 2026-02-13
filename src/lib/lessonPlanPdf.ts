import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { SyllabusLessonPlanResult } from "@/services/aiService";

const HEADER_COLOR: [number, number, number] = [99, 102, 241];
const ROW_ALT: [number, number, number] = [248, 250, 252];

export function generateLessonPlanPDF(
  plan: SyllabusLessonPlanResult,
  subject: string,
  title: string = "Lesson Plan"
): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.setFontSize(18);
  doc.setTextColor(30, 41, 59);
  doc.text(title, 14, 22);
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`${subject} • ${plan.lessons.length} lessons • ${plan.confidence} coverage`, 14, 30);
  doc.setDrawColor(226, 232, 240);
  doc.line(14, 35, (doc as unknown as { getPageWidth: () => number }).getPageWidth() - 14, 35);

  const head = [["#", "Lesson", "Duration", "Topics", "Notes"]];
  const rows = plan.lessons.map((l) => [
    String(l.lessonNo),
    l.title,
    `${l.durationMinutes} min`,
    (l.topics ?? []).slice(0, 3).join(", ") || "—",
    (l.teachingNotes ?? l.activities ?? "").slice(0, 40) + ((l.teachingNotes ?? l.activities ?? "").length > 40 ? "…" : "") || "—",
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

  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? 50;
  if (plan.weeklyDistribution && Object.keys(plan.weeklyDistribution).length > 0) {
    y += 10;
    if (y > 250) doc.addPage();
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text("Weekly distribution", 14, y);
    y += 6;
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    for (const [week, lessonNos] of Object.entries(plan.weeklyDistribution)) {
      doc.text(`${week}: Lessons ${lessonNos.join(", ")}`, 14, y);
      y += 5;
    }
  }
  if (plan.summary) {
    y += 8;
    if (y > 270) doc.addPage();
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text("Summary: " + plan.summary, 14, y, { maxWidth: (doc as unknown as { getPageWidth: () => number }).getPageWidth() - 28 });
  }
  return doc;
}
