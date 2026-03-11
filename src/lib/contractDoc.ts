import { Document, Paragraph, TextRun, Packer, HeadingLevel } from "docx";

export type ContractSignatureInfo = {
  tutorSignatureName?: string | null;
  contractSignedAt?: string | null;
  ownerSignatureName?: string | null;
  ownerSignedAt?: string | null;
  updatedAt?: string | null;
};

/**
 * Generates a Word document (.docx) from contract body text (Markdown).
 * Adds static header (title) and footer (signature block). Returns the document as a Buffer for upload or download.
 */
export async function generateContractDoc(
  contractBodyText: string,
  signatureInfo?: ContractSignatureInfo
): Promise<Buffer> {
  const lines = contractBodyText.split(/\r?\n/);
  const bodyParagraphs = lines.flatMap((line) => {
    const t = line.trim();
    if (!t) return [new Paragraph({ children: [new TextRun({ text: "" })], spacing: { after: 100 } })];
    const isHeading = /^#{1,3}\s/.test(t);
    const text = t.replace(/^#{1,3}\s*/, "");
    return [
      new Paragraph({
        children: [new TextRun({ text, bold: isHeading })],
        heading: isHeading ? HeadingLevel.HEADING_1 : undefined,
        spacing: { after: isHeading ? 150 : 100 },
      }),
    ];
  });

  const tutorDate = signatureInfo?.contractSignedAt
    ? new Date(signatureInfo.contractSignedAt).toLocaleDateString()
    : "Pending";
  const tutorName = signatureInfo?.tutorSignatureName ?? "—";
  const ownerDate = signatureInfo?.ownerSignedAt
    ? new Date(signatureInfo.ownerSignedAt).toLocaleDateString()
    : "Pending";
  const ownerName = signatureInfo?.ownerSignatureName ?? "Awaiting digital signature…";
  const lastUpdatedStr = signatureInfo?.updatedAt
    ? `Last updated: ${new Date(signatureInfo.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
    : null;

  const children: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: "Tutoring Services Agreement", bold: true })],
      heading: HeadingLevel.TITLE,
      spacing: { after: 100 },
    }),
    ...(lastUpdatedStr
      ? [
          new Paragraph({
            children: [new TextRun({ text: lastUpdatedStr, italics: true })],
            spacing: { after: 200 },
          }),
        ]
      : []),
    ...bodyParagraphs,
    new Paragraph({ children: [new TextRun({ text: "" })], spacing: { after: 200 } }),
    new Paragraph({
      children: [new TextRun({ text: "TUTOR SIGNATURE", bold: true })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: tutorName })],
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Date: ${tutorDate}`, italics: true })],
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "CLIENT SIGNATURE", bold: true })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: ownerName, italics: !signatureInfo?.ownerSignatureName })],
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Date: ${ownerDate}`, italics: true })],
    }),
  ];

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
