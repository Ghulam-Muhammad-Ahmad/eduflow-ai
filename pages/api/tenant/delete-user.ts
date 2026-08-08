import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import type { AppRole } from "@/types/auth";

/**
 * Permanently delete a tutor or student account.
 *
 * Only the owner of the workspace the target belongs to may do this, and the target must
 * be a tutor (workspace_members) or student (workspace_students) of that same workspace —
 * an owner can never delete another owner, nor anyone outside their workspace.
 *
 * Deleting the auth user is enough to remove the rest: every domain table that references
 * a user does so via `auth.users(id) ON DELETE CASCADE` (profiles, user_roles,
 * enrollments, submissions, quiz_attempts, workspace_members/students, tutor_contracts,
 * documents-by-owner, …). The user's uploaded files in the private `documents` bucket are
 * removed first, since storage objects are not covered by that cascade.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "DELETE") {
    res.setHeader("Allow", "POST, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { user: caller, error: authError } = await getAuthUser(req, res);
  if (authError || !caller) {
    return res.status(401).json({ error: authError?.message ?? "Unauthorized" });
  }

  if (!supabaseAdmin) {
    return res.status(503).json({ error: "Server configuration error" });
  }

  const body = (req.body || {}) as { userId?: unknown };
  const targetUserId = typeof body.userId === "string" ? body.userId.trim() : "";
  if (!targetUserId) {
    return res.status(400).json({ error: "userId is required" });
  }

  if (targetUserId === caller.id) {
    return res.status(400).json({ error: "You cannot delete your own account from here." });
  }

  const { data: callerRoleRow } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", caller.id)
    .maybeSingle();

  if ((callerRoleRow?.role as AppRole | undefined) !== "admin") {
    return res.status(403).json({ error: "Only workspace owners can delete accounts" });
  }

  const { data: workspace, error: wsErr } = await supabaseAdmin
    .from("workspaces")
    .select("id")
    .eq("owner_id", caller.id)
    .limit(1)
    .maybeSingle();
  if (wsErr || !workspace) {
    return res.status(403).json({ error: "No workspace found for owner" });
  }

  // The target must be a tutor or student of this owner's workspace.
  const [{ data: memberRow }, { data: studentRow }] = await Promise.all([
    supabaseAdmin
      .from("workspace_members")
      .select("id, role")
      .eq("workspace_id", workspace.id)
      .eq("user_id", targetUserId)
      .maybeSingle(),
    supabaseAdmin
      .from("workspace_students")
      .select("id")
      .eq("workspace_id", workspace.id)
      .eq("student_id", targetUserId)
      .maybeSingle(),
  ]);

  const isTutor = !!memberRow && memberRow.role === "tutor";
  const isStudent = !!studentRow;

  if (!isTutor && !isStudent) {
    return res.status(404).json({ error: "That account is not a tutor or student in your workspace." });
  }

  const { data: targetRoleRow } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", targetUserId)
    .maybeSingle();
  if ((targetRoleRow?.role as AppRole | undefined) === "admin") {
    return res.status(403).json({ error: "Owner accounts cannot be deleted from here." });
  }

  // Storage objects are not covered by the auth.users cascade — clear them first so the
  // workspace does not keep paying for orphaned files.
  const { data: docs } = await supabaseAdmin
    .from("documents")
    .select("file_path")
    .eq("user_id", targetUserId);
  const filePaths = (docs ?? []).map((d) => d.file_path).filter(Boolean);
  if (filePaths.length > 0) {
    const { error: storageErr } = await supabaseAdmin.storage.from("documents").remove(filePaths);
    if (storageErr) {
      // Not fatal: the account still needs to go. Log and continue.
      console.error("[tenant/delete-user] storage remove:", storageErr);
    }
  }

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
  if (deleteError) {
    console.error("[tenant/delete-user] deleteUser error:", deleteError);
    return res.status(500).json({ error: deleteError.message || "Failed to delete account" });
  }

  return res.status(200).json({
    success: true,
    userId: targetUserId,
    role: isTutor ? "tutor" : "student",
    message: isTutor ? "Tutor account deleted." : "Student account deleted.",
  });
}
