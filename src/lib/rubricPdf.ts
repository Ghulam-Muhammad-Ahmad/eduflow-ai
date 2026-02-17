import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { RubricJson } from "@/types/rubric";

const HEADER_COLOR: [number, number, number] = [99, 102, 241];
const ROW_ALT: [number, number, number] = [248, 250, 252];

export function generateRubricPDF(rubric: RubricJson, filename: string = "rubric.pdf"): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = (doc as unknown as { getPageWidth: () => number }).getPageWidth();
  const margin = 14;

  doc.setFontSize(18);
  doc.setTextColor(30, 41, 59);
  doc.text(rubric.title || "Assessment Rubric", margin, 22);
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`${rubric.criteria.length} criteria • Total max points: ${rubric.criteria.reduce((s, c) => s + c.max_points, 0)}`, margin, 30);
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, 35, pageWidth - margin, 35);

  let startY = 42;

  rubric.criteria.forEach((criterion, index) => {
    const pageHeight = (doc as unknown as { getPageHeight: () => number }).getPageHeight();
    if (startY > pageHeight - 60) {
      doc.addPage();
      startY = 20;
    }

    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text(`${criterion.name} (max ${criterion.max_points} pts)`, margin, startY);
    startY += 7;

    const head = [["Level", "Points", "Description"]];
    const body = criterion.levels.map((l) => [
      l.level,
      String(l.points),
      l.description.slice(0, 80) + (l.description.length > 80 ? "…" : ""),
    ]);

    autoTable(doc, {
      startY,
      head,
      body,
      theme: "striped",
      headStyles: { fillColor: HEADER_COLOR, textColor: 255 },
      alternateRowStyles: { fillColor: ROW_ALT },
      margin: { left: margin, right: margin },
      tableLineColor: [226, 232, 240],
      tableLineWidth: 0.1,
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 18 },
        2: { cellWidth: "auto" },
      },
    });

    startY = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? startY) + 12;
  });

  doc.save(filename);
  return doc;
}
