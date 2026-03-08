import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import {
  canManageLectureOutcome,
  canManageLectureSession,
  getCallerRole,
  getSessionById,
  getSessionNoteBySessionId,
} from "@/server/lecture-sessions";

type NoteBody = {
  content?: unknown;
};

function parseNoteContent(body: NoteBody) {
  if (typeof body.content !== "string") {
    throw new Error("content is required.");
  }

  return body.content.trim();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sessionId = typeof req.query.id === "string" ? req.query.id : null;
  if (!sessionId) {
    return res.status(400).json({ error: "Session id is required." });
  }

  if (req.method !== "GET" && req.method !== "PUT") {
    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { user, error: authError } = await getAuthUser(req, res);
  if (authError || !user) {
    return res.status(401).json({ error: authError?.message ?? "Unauthorized" });
  }

  if (!supabaseAdmin) {
    return res.status(503).json({ error: "Server configuration error" });
  }

  try {
    const callerRole = await getCallerRole(user.id);
    if (callerRole !== "admin" && callerRole !== "teacher") {
      return res.status(403).json({ error: "Only owners and tutors can access lecture notes." });
    }

    const session = await getSessionById(sessionId);

    if (req.method === "GET") {
      const canView = await canManageLectureSession({
        callerId: user.id,
        callerRole,
        session,
      });

      if (!canView) {
        return res.status(403).json({ error: "You do not have access to these lecture notes." });
      }

      const note = await getSessionNoteBySessionId(session.id);
      return res.status(200).json({ note });
    }

    const canEdit = canManageLectureOutcome({
      callerId: user.id,
      callerRole,
      session,
    });

    if (!canEdit) {
      return res.status(403).json({ error: "Only the assigned tutor can edit lecture notes." });
    }

    const content = parseNoteContent((req.body ?? {}) as NoteBody);
    const existingNote = await getSessionNoteBySessionId(session.id);

    if (content.length === 0) {
      if (existingNote) {
        const { error: deleteError } = await supabaseAdmin
          .from("session_notes")
          .delete()
          .eq("session_id", session.id);

        if (deleteError) throw deleteError;
      }

      return res.status(200).json({ note: null });
    }

    const now = new Date().toISOString();
    const { data: note, error: upsertError } = await supabaseAdmin
      .from("session_notes")
      .upsert(
        {
          session_id: session.id,
          workspace_id: session.workspace_id,
          tutor_id: session.tutor_id,
          content,
          created_by_user_id: existingNote?.created_by_user_id ?? user.id,
          updated_by_user_id: user.id,
          created_at: existingNote?.created_at ?? now,
          updated_at: now,
        },
        { onConflict: "session_id" }
      )
      .select("*")
      .single();

    if (upsertError) throw upsertError;

    return res.status(200).json({ note });
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to save lecture notes.",
    });
  }
}
