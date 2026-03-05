import { jsPDF } from "jspdf";

const MARGIN = 18;
const LINE_HEIGHT = 6;
const FONT_SIZE_BODY = 10;
const FONT_SIZE_TITLE = 14;

/**
 * Generates a PDF document from contract body text.
 * Returns the PDF as a Uint8Array for upload to storage.
 */
export function generateContractPDF(contractBodyText: string): Uint8Array {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.getPageWidth();
  const pageHeight = doc.getPageHeight();
  const maxWidth = pageWidth - MARGIN * 2;

  doc.setFontSize(FONT_SIZE_TITLE);
  doc.setTextColor(30, 41, 59);
  doc.text("Tutoring Services Agreement", MARGIN, 20);
  doc.setDrawColor(226, 232, 240);
  doc.line(MARGIN, 26, pageWidth - MARGIN, 26);

  doc.setFontSize(FONT_SIZE_BODY);
  doc.setTextColor(51, 65, 85);

  const lines = contractBodyText.split(/\r?\n/);
  let y = 34;

  for (const line of lines) {
    if (y > pageHeight - 25) {
      doc.addPage();
      y = 20;
    }
    const wrapped = doc.splitTextToSize(line || " ", maxWidth);
    for (const part of wrapped) {
      if (y > pageHeight - 25) {
        doc.addPage();
        y = 20;
      }
      doc.text(part, MARGIN, y);
      y += LINE_HEIGHT;
    }
  }

  return doc.output("arraybuffer") as Uint8Array;
}
