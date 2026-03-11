import { jsPDF } from "jspdf";

const MARGIN = 18;
const LINE_HEIGHT = 6;
const FONT_SIZE_BODY = 10;
const FONT_SIZE_TITLE = 14;

export type ContractSignatureInfo = {
  tutorSignatureName?: string | null;
  contractSignedAt?: string | null;
  ownerSignatureName?: string | null;
  ownerSignedAt?: string | null;
  updatedAt?: string | null;
};

/**
 * Generates a PDF document from contract body text.
 * Adds static header (title) and footer (signature block). Returns the PDF as a Uint8Array for upload to storage.
 */
export function generateContractPDF(
  contractBodyText: string,
  signatureInfo?: ContractSignatureInfo
): Uint8Array {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.getPageWidth();
  const pageHeight = doc.getPageHeight();
  const maxWidth = pageWidth - MARGIN * 2;

  doc.setFontSize(FONT_SIZE_TITLE);
  doc.setTextColor(30, 41, 59);
  doc.text("Tutoring Services Agreement", MARGIN, 20);
  const lastUpdatedStr = signatureInfo?.updatedAt
    ? `Last updated: ${new Date(signatureInfo.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
    : null;
  if (lastUpdatedStr) {
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(lastUpdatedStr, MARGIN, 26);
  }
  doc.setDrawColor(226, 232, 240);
  doc.line(MARGIN, lastUpdatedStr ? 32 : 26, pageWidth - MARGIN, lastUpdatedStr ? 32 : 26);

  doc.setFontSize(FONT_SIZE_BODY);
  doc.setTextColor(51, 65, 85);

  const lines = contractBodyText.split(/\r?\n/);
  let y = lastUpdatedStr ? 40 : 34;

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

  // Signature block (static footer)
  y += LINE_HEIGHT * 2;
  if (y > pageHeight - 45) {
    doc.addPage();
    y = 20;
  }
  doc.setDrawColor(226, 232, 240);
  doc.line(MARGIN, y, pageWidth - MARGIN, y);
  y += LINE_HEIGHT * 2;

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("TUTOR SIGNATURE", MARGIN, y);
  y += LINE_HEIGHT;
  doc.setFontSize(FONT_SIZE_BODY);
  doc.setTextColor(30, 41, 59);
  doc.text(signatureInfo?.tutorSignatureName ?? "—", MARGIN, y);
  y += LINE_HEIGHT;
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  const tutorDate = signatureInfo?.contractSignedAt
    ? new Date(signatureInfo.contractSignedAt).toLocaleDateString()
    : "Pending";
  doc.text(`Date: ${tutorDate}`, MARGIN, y);
  y += LINE_HEIGHT * 2;

  const ownerName = signatureInfo?.ownerSignatureName ?? "Awaiting digital signature…";
  const ownerDate = signatureInfo?.ownerSignedAt
    ? new Date(signatureInfo.ownerSignedAt).toLocaleDateString()
    : "Pending";
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("CLIENT SIGNATURE", pageWidth / 2 + MARGIN / 2, y - LINE_HEIGHT * 2);
  doc.setFontSize(FONT_SIZE_BODY);
  doc.setTextColor(30, 41, 59);
  doc.text(ownerName, pageWidth / 2 + MARGIN / 2, y - LINE_HEIGHT);
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Date: ${ownerDate}`, pageWidth / 2 + MARGIN / 2, y);

  return doc.output("arraybuffer") as Uint8Array;
}
