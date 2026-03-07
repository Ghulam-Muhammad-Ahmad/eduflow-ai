import { Document, Paragraph, TextRun, Packer, HeadingLevel } from "docx";

/**
 * Generates a Word document (.docx) from contract body text (Markdown).
 * Returns the document as a Buffer for upload or download.
 */
export async function generateContractDoc(contractBodyText: string): Promise<Buffer> {
  const lines = contractBodyText.split(/\r?\n/);
  const children: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: "Tutoring Services Agreement", bold: true })],
      heading: HeadingLevel.TITLE,
      spacing: { after: 200 },
    }),
    ...lines.flatMap((line) => {
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
