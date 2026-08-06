import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  UserRound,
  Video,
  FileText,
  BookOpen,
  ClipboardCheck,
  ListChecks,
  GraduationCap,
  Wallet,
  TrendingUp,
} from "lucide-react";

export interface StudentNavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  path: string;
}

/**
 * The student sidebar's item list, in display order. `key` is the stable identifier used
 * to store nav visibility overrides (workspace default + per-student), independent of
 * `path` or `label` so either can change without breaking stored settings.
 *
 * "dashboard" is always force-visible — see DashboardLayout — so it is excluded from
 * TOGGLEABLE_STUDENT_NAV_ITEMS, the list shown in the owner's hide/show UI.
 */
export const STUDENT_NAV_ITEMS: StudentNavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/dashboard/student" },
  { key: "classrooms", label: "My Classes", icon: Users, path: "/dashboard/student/classrooms" },
  { key: "rooms", label: "1v1 Rooms", icon: UserRound, path: "/dashboard/student/rooms" },
  { key: "sessions", label: "Sessions", icon: Video, path: "/dashboard/student/sessions" },
  { key: "documents", label: "My Documents", icon: FileText, path: "/dashboard/student/documents" },
  {
    key: "course-materials",
    label: "Course Materials",
    icon: BookOpen,
    path: "/dashboard/student/course-materials",
  },
  {
    key: "assignments",
    label: "Assignments",
    icon: ClipboardCheck,
    path: "/dashboard/student/assignments",
  },
  { key: "quizzes", label: "Quizzes", icon: ListChecks, path: "/dashboard/student/quizzes" },
  { key: "progress", label: "My Progress", icon: TrendingUp, path: "/dashboard/student/progress" },
  { key: "study", label: "Study Hub", icon: GraduationCap, path: "/dashboard/student/study" },
  { key: "billing", label: "My Billing", icon: Wallet, path: "/dashboard/student/billing" },
];

export const TOGGLEABLE_STUDENT_NAV_ITEMS = STUDENT_NAV_ITEMS.filter((item) => item.key !== "dashboard");

/**
 * Merge a workspace-wide default with a student's own override.
 *
 * The override wins whenever it is explicitly present — including an explicit empty
 * array, which means "show everything" and must NOT fall back to the workspace default.
 * Only `null`/`undefined` (no override set) falls through to the default.
 */
export function resolveHiddenNavKeys(
  workspaceDefault: string[] | undefined,
  studentOverride: string[] | undefined | null
): Set<string> {
  const effective = studentOverride ?? workspaceDefault ?? [];
  return new Set(effective);
}
