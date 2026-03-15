/**
 * Payment proof storage: upload to payment-proofs bucket and create signed URLs.
 * Path pattern: {workspace_id}/{entity_type}/{entity_id}.{ext}
 * entity_type: "payouts" | "invoices"
 */
import { supabaseAdmin } from "@/integrations/supabase/admin";

const BUCKET = "payment-proofs";
const SIGNED_URL_EXPIRY_SEC = 3600; // 1 hour

const ALLOWED_MIME = ["image/png", "image/jpeg", "image/jpg", "application/pdf"];
const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "application/pdf": "pdf",
};

function assertAdmin() {
  if (!supabaseAdmin) throw new Error("Server configuration error");
  return supabaseAdmin;
}

/**
 * Upload a proof file to payment-proofs. Returns storage path to store in DB.
 * Path: {workspaceId}/{entityType}/{entityId}.{ext}
 */
export async function uploadPaymentProof(params: {
  workspaceId: string;
  entityType: "payouts" | "invoices";
  entityId: string;
  file: Buffer | Blob;
  mimeType: string;
}): Promise<string> {
  const admin = assertAdmin();
  const ext = EXT_BY_MIME[params.mimeType] || "bin";
  if (!ALLOWED_MIME.includes(params.mimeType)) {
    throw new Error("Invalid file type. Allowed: PNG, JPG, PDF.");
  }
  const path = `${params.workspaceId}/${params.entityType}/${params.entityId}.${ext}`;

  const { error } = await admin.storage.from(BUCKET).upload(path, params.file, {
    contentType: params.mimeType,
    upsert: true,
  });

  if (error) throw error;
  return path;
}

/**
 * Create a signed URL for viewing a proof. Caller must have been authorized by API (owner / tutor for own payout / student for own invoice).
 * storagePath: e.g. workspaceId/payouts/entityId.pdf
 */
export async function createProofSignedUrl(storagePath: string, expirySeconds = SIGNED_URL_EXPIRY_SEC): Promise<string> {
  const admin = assertAdmin();
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(storagePath, expirySeconds);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error("Failed to create signed URL");
  return data.signedUrl;
}
