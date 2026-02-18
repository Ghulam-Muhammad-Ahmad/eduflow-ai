import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/integrations/supabase/server";
import { PDFDocument } from "pdf-lib";

/**
 * POST body: { documentId: string }
 * Returns { numPages: number } for a PDF in Doc Center.
 * User must own the document. Requires SUPABASE_SERVICE_ROLE_KEY.
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

  const { documentId } = req.body || {};
  if (!documentId || typeof documentId !== "string") {
    return res.status(400).json({ error: "documentId required" });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({
      error:
        "Server not configured for document operations (missing Supabase keys)",
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
    if (doc.user_id !== user.id) {
      return res.status(403).json({
        error: "Not allowed to access this document",
      });
    }

    const mime = (doc.file_type || "").toLowerCase();
    const nameLower = (doc.name || "").toLowerCase();
    if (!mime.includes("pdf") && !nameLower.endsWith(".pdf")) {
      return res.status(400).json({ error: "Document is not a PDF" });
    }

    const { data: blob, error: downloadError } = await supabase.storage
      .from("documents")
      .download(doc.file_path);

    if (downloadError || !blob) {
      return res.status(500).json({ error: "Failed to download document" });
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    const pdfDoc = await PDFDocument.load(buffer);
    const numPages = pdfDoc.getPageCount();

    return res.status(200).json({ numPages });
  } catch (err: unknown) {
    console.error("PDF page count error:", err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to read PDF",
    });
  }
}
