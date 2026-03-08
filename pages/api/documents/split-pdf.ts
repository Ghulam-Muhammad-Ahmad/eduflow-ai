import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/integrations/supabase/server";
import { PDFDocument } from "pdf-lib";
import {
  parsePageRange,
  validatePageNumbers,
  MAX_PAGES_PER_SPLIT,
} from "@/lib/pageRange";
import { ensureUserCanStoreBytes } from "@/server/storage-allocation";

/**
 * POST body: { documentId: string, pageRange: string, newFileName: string }
 * Creates a new PDF in Doc Center containing only the selected pages.
 * User must own the source document. Requires SUPABASE_SERVICE_ROLE_KEY.
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

  const { documentId, pageRange, newFileName } = req.body || {};
  if (
    !documentId ||
    typeof documentId !== "string" ||
    !pageRange ||
    typeof pageRange !== "string" ||
    !newFileName ||
    typeof newFileName !== "string"
  ) {
    return res.status(400).json({
      error: "documentId, pageRange, and newFileName are required",
    });
  }

  const nameTrimmed = newFileName.trim();
  if (!nameTrimmed.toLowerCase().endsWith(".pdf")) {
    return res.status(400).json({
      error: "New file name must end with .pdf",
    });
  }
  if (nameTrimmed.includes("/") || nameTrimmed.includes("\\")) {
    return res.status(400).json({
      error: "File name cannot contain path characters",
    });
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
      return res.status(400).json({
        error: "Only PDF documents can be split",
      });
    }

    const { data: blob, error: downloadError } = await supabase.storage
      .from("documents")
      .download(doc.file_path);

    if (downloadError || !blob) {
      return res.status(500).json({
        error: "Failed to download document",
      });
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    const srcDoc = await PDFDocument.load(buffer);
    const numPages = srcDoc.getPageCount();

    const pages = parsePageRange(pageRange);
    if (!pages) {
      return res.status(400).json({
        error:
          "Invalid page range. Use e.g. 1-3, 8, 10-12 (comma-separated numbers or ranges).",
      });
    }

    const validation = validatePageNumbers(
      pages,
      numPages,
      MAX_PAGES_PER_SPLIT
    );
    if (!validation.ok) {
      return res.status(400).json({ error: validation.error });
    }

    const indices = validation.pages.map((p) => p - 1);
    const newDoc = await PDFDocument.create();
    const copiedPages = await newDoc.copyPages(srcDoc, indices);
    for (const page of copiedPages) {
      newDoc.addPage(page);
    }

    const pdfBytes = await newDoc.save();
    const storageCheck = await ensureUserCanStoreBytes(supabase, user.id, pdfBytes.length);
    if (!storageCheck.ok) {
      return res.status(400).json({ error: storageCheck.error });
    }
    const newFilePath = `${user.id}/${Date.now()}_${nameTrimmed}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(newFilePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      return res.status(500).json({
        error: "Failed to upload new document",
      });
    }

    const { data: newRow, error: insertError } = await supabase
      .from("documents")
      .insert({
        user_id: user.id,
        folder_id: null,
        name: nameTrimmed,
        file_path: newFilePath,
        file_size: pdfBytes.length,
        file_type: "application/pdf",
      })
      .select("id, name, file_path, file_size, file_type, created_at")
      .single();

    if (insertError) {
      await supabase.storage.from("documents").remove([newFilePath]);
      return res.status(500).json({
        error: "Failed to save document record",
      });
    }

    return res.status(200).json({
      document: newRow,
    });
  } catch (err: unknown) {
    console.error("Split PDF error:", err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to split PDF",
    });
  }
}
