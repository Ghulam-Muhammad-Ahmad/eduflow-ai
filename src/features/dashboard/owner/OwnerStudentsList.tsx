import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { GraduationCap, UserPlus, Search, Eye, Trash2 } from "lucide-react";
import DeleteAccountDialog from "@/features/dashboard/owner/components/DeleteAccountDialog";

type WorkspaceStudent = {
  student_id: string;
  workspace_id: string;
  student?: { display_name: string | null; email: string | null; avatar_url?: string | null } | null;
};

type EnrollmentRow = {
  student_id: string;
  classroom_id: string;
  status: string;
  classrooms: { name: string } | null;
};

export default function OwnerStudentsList() {
  const { workspace, assignedStudents, classrooms, oneToOneRooms, isLoading } = useOwnerWorkspace();
  const students = (assignedStudents ?? []) as WorkspaceStudent[];
  const [searchQuery, setSearchQuery] = useState("");
  const [studentToDelete, setStudentToDelete] = useState<{ userId: string; name: string } | null>(
    null
  );

  const classroomIds = useMemo(() => classrooms.map((c) => c.id), [classrooms]);
  const { data: enrollments = [] } = useQuery({
    queryKey: ["owner-workspace-enrollments", classroomIds],
    queryFn: async () => {
      if (classroomIds.length === 0) return [];
      const { data, error } = await supabase
        .from("enrollments")
        .select("student_id, classroom_id, status, classrooms(name)")
        .in("classroom_id", classroomIds)
        .neq("status", "removed");
      if (error) throw error;
      return (data ?? []) as EnrollmentRow[];
    },
    enabled: classroomIds.length > 0,
  });

  const studentClassrooms = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const e of enrollments) {
      const name = e.classrooms?.name ?? "Classroom";
      const list = map.get(e.student_id) ?? [];
      if (!list.includes(name)) list.push(name);
      map.set(e.student_id, list);
    }
    return map;
  }, [enrollments]);

  const studentOneToOneRooms = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const r of oneToOneRooms ?? []) {
      const name = r.name ?? (r as { tutorProfile?: { display_name?: string | null } }).tutorProfile?.display_name ?? "1v1 room";
      const list = map.get(r.student_id) ?? [];
      if (!list.includes(name)) list.push(name);
      map.set(r.student_id, list);
    }
    return map;
  }, [oneToOneRooms]);

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase().trim();
    return students.filter((s) => {
      const name = (s.student?.display_name ?? "").toLowerCase();
      const email = (s.student?.email ?? "").toLowerCase();
      const inClassrooms = (studentClassrooms.get(s.student_id) ?? []).join(" ").toLowerCase();
      const inRooms = (studentOneToOneRooms.get(s.student_id) ?? []).join(" ").toLowerCase();
      return name.includes(q) || email.includes(q) || inClassrooms.includes(q) || inRooms.includes(q);
    });
  }, [students, searchQuery, studentClassrooms, studentOneToOneRooms]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Students</h1>
            <p className="text-muted-foreground">
              {workspace?.name ?? "Workspace"} · Assign students to tutors
            </p>
          </div>
          <Button variant="default" asChild>
            <Link href="/dashboard/owner/students/invite">
              <UserPlus className="mr-2 h-4 w-4" />
              Create student account
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : students.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <GraduationCap className="mx-auto h-12 w-12 text-muted-foreground" />
            <h2 className="mt-4 font-semibold">No students assigned yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Create student accounts and assign them to tutors. Share login details with them.
            </p>
            <Button variant="default" asChild className="mt-4">
              <Link href="/dashboard/owner/students/invite">Create student account</Link>
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden />
                <Input
                  type="search"
                  placeholder="Search by name, email, classroom, or 1v1 room..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  aria-label="Search students"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/80 bg-muted/30">
                    <th className="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Student
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Email
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Classrooms
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      1v1 rooms
                    </th>
                    <th className="px-6 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground w-32">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-sm text-muted-foreground">
                        No students match &quot;{searchQuery}&quot;. Try a different search.
                      </td>
                    </tr>
                  ) : filteredStudents.map((s) => {
                    const classNames = studentClassrooms.get(s.student_id) ?? [];
                    const roomNames = studentOneToOneRooms.get(s.student_id) ?? [];
                    return (
                      <tr key={s.student_id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-3.5">
                          <Link
                            href={`/dashboard/owner/students/${s.student_id}`}
                            className="flex items-center gap-3 font-medium text-foreground hover:text-primary transition-colors"
                          >
                            <Avatar className="h-9 w-9 rounded-full border border-border">
                              <AvatarImage src={s.student?.avatar_url ?? undefined} alt="" />
                              <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                                {(s.student?.display_name ?? "S")[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            {s.student?.display_name ?? "Student"}
                          </Link>
                        </td>
                        <td className="px-6 py-3.5 text-muted-foreground">
                          {s.student?.email ?? "—"}
                        </td>
                        <td className="px-6 py-3.5 text-muted-foreground text-xs max-w-[180px]">
                          {classNames.length > 0 ? classNames.join(", ") : "—"}
                        </td>
                        <td className="px-6 py-3.5 text-muted-foreground text-xs max-w-[180px]">
                          {roomNames.length > 0 ? roomNames.join(", ") : "—"}
                        </td>
                        <td className="px-6 py-3.5">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="default" size="sm" asChild>
                              <Link href={`/dashboard/owner/students/${s.student_id}`} className="inline-flex items-center gap-2" aria-label={`View ${s.student?.display_name ?? "student"}`}>
                                <Eye className="h-4 w-4" />
                                View
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() =>
                                setStudentToDelete({
                                  userId: s.student_id,
                                  name: s.student?.display_name ?? "this student",
                                })
                              }
                              aria-label={`Delete ${s.student?.display_name ?? "student"}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {studentToDelete && (
        <DeleteAccountDialog
          open
          onOpenChange={(next) => {
            if (!next) setStudentToDelete(null);
          }}
          userId={studentToDelete.userId}
          displayName={studentToDelete.name}
          accountType="student"
        />
      )}
    </DashboardLayout>
  );
}
