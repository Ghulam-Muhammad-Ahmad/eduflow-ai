import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";

export interface StudentTutorSummary {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  subjects: string[];
  /** Classrooms the student shares with this tutor. */
  classrooms: { id: string; name: string; subject: string | null }[];
  /** 1v1 rooms the student shares with this tutor. */
  one_to_one_rooms: { id: string; name: string | null }[];
}

/**
 * Tutors the signed-in student actually works with — the teacher and co-tutors of every
 * classroom they are actively enrolled in, plus the tutor of each of their 1v1 rooms.
 *
 * This runs with the admin client because it joins `tutor_contracts` for the subjects a
 * tutor teaches, and that table also holds pay rates. Only the tutor's name, avatar, bio
 * and subject list are ever returned; nothing financial leaves this handler. Membership is
 * derived from the caller's own enrolments/rooms, so a student can never widen the set.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { user, error: authError } = await getAuthUser(req, res);
  if (authError || !user) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(503).json({ error: "Server configuration error" });

  const { data: roleRow } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (roleRow?.role !== "student") {
    return res.status(403).json({ error: "Only students can view their tutors" });
  }

  // Classrooms the student is actively enrolled in.
  const { data: enrollments } = await supabaseAdmin
    .from("enrollments")
    .select("classroom_id")
    .eq("student_id", user.id)
    .eq("status", "active");
  const classroomIds = (enrollments ?? []).map((e) => e.classroom_id);

  const classroomById = new Map<string, { id: string; name: string; subject: string | null }>();
  const tutorIdsByClassroom = new Map<string, Set<string>>();

  if (classroomIds.length > 0) {
    const [{ data: classrooms }, { data: coTutors }] = await Promise.all([
      supabaseAdmin.from("classrooms").select("id, name, subject, teacher_id").in("id", classroomIds),
      supabaseAdmin.from("classroom_tutors").select("classroom_id, user_id").in("classroom_id", classroomIds),
    ]);

    for (const c of classrooms ?? []) {
      classroomById.set(c.id, { id: c.id, name: c.name, subject: c.subject ?? null });
      const set = tutorIdsByClassroom.get(c.id) ?? new Set<string>();
      if (c.teacher_id) set.add(c.teacher_id);
      tutorIdsByClassroom.set(c.id, set);
    }
    for (const ct of coTutors ?? []) {
      const set = tutorIdsByClassroom.get(ct.classroom_id) ?? new Set<string>();
      set.add(ct.user_id);
      tutorIdsByClassroom.set(ct.classroom_id, set);
    }
  }

  // 1v1 rooms belonging to the student.
  const { data: rooms } = await supabaseAdmin
    .from("one_to_one_rooms")
    .select("id, name, tutor_id")
    .eq("student_id", user.id);

  const tutorIds = new Set<string>();
  for (const set of tutorIdsByClassroom.values()) {
    for (const id of set) tutorIds.add(id);
  }
  for (const room of rooms ?? []) tutorIds.add(room.tutor_id);

  if (tutorIds.size === 0) return res.status(200).json({ tutors: [] });

  const ids = [...tutorIds];
  const [{ data: profiles }, { data: contracts }] = await Promise.all([
    supabaseAdmin.from("profiles").select("user_id, display_name, avatar_url, bio").in("user_id", ids),
    supabaseAdmin.from("tutor_contracts").select("tutor_id, subjects").in("tutor_id", ids),
  ]);

  const subjectsByTutor = new Map<string, string[]>();
  for (const contract of contracts ?? []) {
    const subjects = Array.isArray(contract.subjects)
      ? (contract.subjects as unknown[]).filter((s): s is string => typeof s === "string")
      : [];
    // A tutor can have more than one contract row; union the subjects rather than clobbering.
    const merged = new Set([...(subjectsByTutor.get(contract.tutor_id) ?? []), ...subjects]);
    subjectsByTutor.set(contract.tutor_id, [...merged]);
  }

  const profileByUserId = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  const tutors: StudentTutorSummary[] = ids.map((tutorId) => {
    const profile = profileByUserId.get(tutorId);
    const sharedClassrooms = [...tutorIdsByClassroom.entries()]
      .filter(([, tutorSet]) => tutorSet.has(tutorId))
      .map(([classroomId]) => classroomById.get(classroomId))
      .filter((c): c is { id: string; name: string; subject: string | null } => !!c);

    return {
      user_id: tutorId,
      display_name: profile?.display_name ?? "Tutor",
      avatar_url: profile?.avatar_url ?? null,
      bio: profile?.bio ?? null,
      subjects: subjectsByTutor.get(tutorId) ?? [],
      classrooms: sharedClassrooms,
      one_to_one_rooms: (rooms ?? [])
        .filter((r) => r.tutor_id === tutorId)
        .map((r) => ({ id: r.id, name: r.name })),
    };
  });

  tutors.sort((a, b) => a.display_name.localeCompare(b.display_name));

  return res.status(200).json({ tutors });
}
