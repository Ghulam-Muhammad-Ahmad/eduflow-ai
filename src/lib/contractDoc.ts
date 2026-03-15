import {
  Document,
  Paragraph,
  TextRun,
  Packer,
  HeadingLevel,
  Header,
  ImageRun,
  AlignmentType,
} from "docx";

const BLACK = "000000";

export type ContractSignatureInfo = {
  tutorSignatureName?: string | null;
  contractSignedAt?: string | null;
  ownerSignatureName?: string | null;
  ownerSignedAt?: string | null;
  updatedAt?: string | null;
};

export type WatermarkLogo = {
  data: Buffer;
  type: "png" | "jpg" | "gif" | "bmp";
};

/**
 * Generates a Word document (.docx) from contract body text (Markdown).
 * Adds static header (title) and footer (signature block). Optional header with workspace logo (left) and workspace name.
 * Uses black/system-friendly text color for headings and body. Returns the document as a Buffer for upload or download.
 */
export async function generateContractDoc(
  contractBodyText: string,
  signatureInfo?: ContractSignatureInfo,
  options?: { watermarkLogo?: WatermarkLogo; workspaceName?: string }
): Promise<Buffer> {
  const lines = contractBodyText.split(/\r?\n/);
  const bodyParagraphs = lines.flatMap((line) => {
    const t = line.trim();
    if (!t)
      return [
        new Paragraph({
          children: [new TextRun({ text: "", color: BLACK })],
          spacing: { after: 100 },
        }),
      ];
    const isHeading = /^#{1,3}\s/.test(t);
    const text = t.replace(/^#{1,3}\s*/, "");
    return [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold: isHeading,
            color: BLACK,
          }),
        ],
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
      children: [
        new TextRun({ text: "Tutoring Services Agreement", bold: true, color: BLACK }),
      ],
      heading: HeadingLevel.TITLE,
      spacing: { after: 100 },
    }),
    ...(lastUpdatedStr
      ? [
          new Paragraph({
            children: [
              new TextRun({ text: lastUpdatedStr, italics: true, color: BLACK }),
            ],
            spacing: { after: 200 },
          }),
        ]
      : []),
    ...bodyParagraphs,
    new Paragraph({
      children: [new TextRun({ text: "", color: BLACK })],
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "TUTOR SIGNATURE", bold: true, color: BLACK }),
      ],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: tutorName, color: BLACK })],
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Date: ${tutorDate}`, italics: true, color: BLACK }),
      ],
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "CLIENT SIGNATURE",
          bold: true,
          color: BLACK,
        }),
      ],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: ownerName,
          italics: !signatureInfo?.ownerSignatureName,
          color: BLACK,
        }),
      ],
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Date: ${ownerDate}`,
          italics: true,
          color: BLACK,
        }),
      ],
    }),
  ];

  const watermarkLogo = options?.watermarkLogo;
  const workspaceName = options?.workspaceName?.trim() ?? "";
  const hasHeader = watermarkLogo || workspaceName;
  const header =
    hasHeader &&
    new Header({
      children: [
        new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [
            ...(watermarkLogo
              ? [
                  new ImageRun({
                    data: watermarkLogo.data,
                    transformation: { width: 72, height: 72 },
                    type: watermarkLogo.type,
                  }),
                  new TextRun({ text: " ", color: BLACK }), // space between logo and name
                ]
              : []),
            ...(workspaceName
              ? [
                  new TextRun({
                    text: workspaceName,
                    bold: true,
                    color: BLACK,
                    size: 24, // 12 pt
                  }),
                ]
              : []),
          ].filter(Boolean),
        }),
      ],
    });

  const doc = new Document({
    sections: [
      {
        properties: {},
        headers: header ? { default: header } : undefined,
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
