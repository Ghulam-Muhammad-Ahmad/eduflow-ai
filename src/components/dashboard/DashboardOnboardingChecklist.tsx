"use client";

import { Users, GraduationCap, ClipboardCheck, School, UserPlus } from "lucide-react";
import { OnboardingChecklist, type OnboardingItem } from "@/components/dashboard/OnboardingChecklist";
import { useAuth } from "@/hooks/useAuth";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useTutorOnboardingStats } from "@/hooks/useTutorOnboardingStats";
import { useHasClassrooms } from "@/hooks/useHasClassrooms";

/**
 * Renders the onboarding checklist in the dashboard layout so it appears on every dashboard page.
 * Content is role-specific (owner, teacher, student).
 */
export function DashboardOnboardingChecklist() {
  const { user, role } = useAuth();
  const { stats } = useOwnerWorkspace();
  const { classroomsCount, assignmentsCount, enrollmentsCount } = useTutorOnboardingStats();
  const { hasClassrooms } = useHasClassrooms();

  const displayName = user?.user_metadata?.display_name ?? user?.email?.split("@")[0] ?? "User";

  if (role === "admin") {
    const items: OnboardingItem[] = [
      { label: "Create your first tutor account", done: stats.tutorsCount >= 1, href: "/dashboard/owner/tutors/invite", icon: Users },
      { label: "Create your first student account", done: stats.studentsCount >= 1, href: "/dashboard/owner/students/invite", icon: GraduationCap },
      { label: "Assign a student to a tutor", done: stats.studentsCount >= 1, href: "/dashboard/owner/students", icon: ClipboardCheck },
    ];
    return (
      <OnboardingChecklist
        title="Get your workspace ready"
        instructionText="Complete these steps to set up your workspace."
        items={items}
        hideWhenComplete
      />
    );
  }

  if (role === "teacher") {
    const items: OnboardingItem[] = [
      { label: "Create your first classroom", done: classroomsCount >= 1, href: "/dashboard/teacher/classrooms", icon: School },
      { label: "Invite or add a student to a class", done: enrollmentsCount >= 1, href: "/dashboard/teacher/classrooms", icon: UserPlus },
      { label: "Create your first assignment", done: assignmentsCount >= 1, href: "/dashboard/teacher/assignments", icon: ClipboardCheck },
    ];
    return (
      <OnboardingChecklist
        userName={displayName}
        instructionText="Complete all steps to get the most out of your tutor dashboard."
        items={items}
        hideWhenComplete
      />
    );
  }

  if (role === "student") {
    const items: OnboardingItem[] = [
      { label: "Join a class with a code", done: hasClassrooms, href: "/dashboard/student", icon: UserPlus },
    ];
    return (
      <OnboardingChecklist
        userName={displayName}
        instructionText="Join a class to get started and see assignments and materials."
        items={items}
        hideWhenComplete={false}
      />
    );
  }

  return null;
}
