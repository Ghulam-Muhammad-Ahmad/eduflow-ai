import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";

/**
 * POST body: { base64: string, fileName: string }
 * Extracts text from an uploaded file (PDF, DOCX, DOC, TXT).
 * Used when the user uploads a file in Paper Generator or similar (not from Doc Center).
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { user, error: authError } = await getAuthUser(req, res);
  if (authError || !user) {
    return res.status(401).json({ error: authError?.message ?? "Unauthorized" });
  }

  const { base64, fileName } = req.body || {};
  if (!base64 || typeof base64 !== "string" || !fileName || typeof fileName !== "string") {
    return res.status(400).json({ error: "base64 and fileName required" });
  }

  try {
    const buffer = Buffer.from(base64, "base64");
    const name = fileName.trim() || "document";
    const lower = name.toLowerCase();

    let text = "";

    if (lower.endsWith(".pdf")) {
      try {
        const pdfParse = (await import("pdf-parse")).default;
        const result = await pdfParse(buffer);
        text = result?.text ?? "";
      } catch {
        return res.status(400).json({
          error: "PDF text extraction failed. Try a different file or paste content.",
        });
      }
    } else if (lower.endsWith(".docx") || lower.endsWith(".doc")) {
      try {
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ buffer });
        text = result?.value ?? "";
      } catch {
        return res.status(400).json({
          error: "DOCX/DOC text extraction failed. Try a different file or paste content.",
        });
      }
    } else if (lower.endsWith(".txt") || lower.endsWith(".text")) {
      text = buffer.toString("utf-8");
    } else {
      return res.status(400).json({
        error: "Unsupported format. Use PDF, DOCX, DOC, or TXT.",
      });
    }

    return res.status(200).json({ text: text.trim(), name });
  } catch (err: unknown) {
    console.error("Extract-file error:", err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to extract text",
    });
  }
}
