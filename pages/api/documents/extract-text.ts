import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

/**
 * POST body: { documentId: string, userId: string }
 * Returns extracted text from a PDF or DOCX in Doc Center.
 * Requires SUPABASE_SERVICE_ROLE_KEY for server-side storage access.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { documentId, userId } = req.body || {};
  if (!documentId || !userId) {
    return res.status(400).json({ error: "documentId and userId required" });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({
      error: "Server not configured for document extraction (missing Supabase keys)",
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("id, file_path, file_type, name, user_id")
      .eq("id", documentId)
      .single();

    if (docError || !doc) {
      return res.status(404).json({ error: "Document not found" });
    }
    if (doc.user_id !== userId) {
      return res.status(403).json({ error: "Not allowed to access this document" });
    }

    const { data: blob, error: downloadError } = await supabase.storage
      .from("documents")
      .download(doc.file_path);

    if (downloadError || !blob) {
      return res.status(500).json({ error: "Failed to download document" });
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    const mime = doc.file_type || "";
    let text = "";

    if (mime.includes("pdf") || doc.name.toLowerCase().endsWith(".pdf")) {
      try {
        const pdfParse = (await import("pdf-parse")).default;
        const result = await pdfParse(buffer);
        text = result?.text ?? "";
      } catch (e) {
        return res.status(400).json({
          error: "PDF text extraction failed. Try pasting the content manually.",
        });
      }
    } else if (
      mime.includes("wordprocessingml") ||
      mime.includes("msword") ||
      doc.name.toLowerCase().endsWith(".docx") ||
      doc.name.toLowerCase().endsWith(".doc")
    ) {
      try {
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ buffer });
        text = result?.value ?? "";
      } catch (e) {
        return res.status(400).json({
          error: "DOCX text extraction failed. Try pasting the content manually.",
        });
      }
    } else if (mime.includes("plain") || doc.name.toLowerCase().endsWith(".txt")) {
      text = buffer.toString("utf-8");
    } else {
      return res.status(400).json({
        error: "Unsupported format. Use PDF, DOCX, or paste text manually.",
      });
    }

    return res.status(200).json({ text: text.trim(), name: doc.name });
  } catch (err: unknown) {
    console.error("Document extract-text error:", err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to extract text",
    });
  }
}
