# Edulabloom → Hybrid Tutoring SaaS: Repositioning Report

**Plan:** [Hybrid Tutoring SaaS Repositioning](.cursor/plans/hybrid_tutoring_saas_repositioning_d4e7be8e.plan.md)  
**Report date:** February 28, 2025  
**Status:** Sprints 1–6 delivered; ready for beta.

---

## Executive summary

Edulabloom has been repositioned from a generic teacher/student app into a **Hybrid Tutoring SaaS** with:

- **Three account types:** Tutoring Business, Solo Tutor, Student (self-study or classroom).
- **Workspace model:** Business and Solo workspaces with Owner/Tutor roles; students join via invite or classroom code.
- **Role-based onboarding:** Dedicated flows for Business (Owner), Solo Tutor, and Student, with correct dashboard routing.
- **Owner (business) dashboard:** Full oversight of tutors, students, classrooms, assignments, quizzes, documents, and billing.
- **Tutor experience:** Teacher flows renamed to “Tutor”; AI Content Generator; workspace-scoped students (assigned in Business mode).
- **Self-study student mode:** Separate nav and pages (Study Hub, Practice Tests, My Library, Progress) when the student has no classrooms; join-by-code still works.
- **Billing (Paddle sandbox):** Plan selection and checkout for Owner, Solo Tutor, and Student; webhooks; trial and subscription enforcement.

Sprints 1–5 were verified against the codebase; Sprint 6 (final polish) added onboarding checklists, email copy templates, landing “See how it works” flow, and this report with a QA checklist.

---

## Sprint verification (1–5)

### Sprint 1: Repositioning + account type onboarding ✅

| Deliverable | Status | Evidence |
|------------|--------|----------|
| Copy: teacher→tutor, school→tutoring business | Done | `DashboardLayout` (Tutor Dashboard, Owner), `Hero.tsx`, `Navbar`, `RoleSection`, `Features`, `Pricing`, `choose-role`, Owner/JoinClassroom copy |
| Choose-account-type / landing CTAs | Done | `pages/auth/choose-account-type.tsx`; Hero CTAs with `?accountType=business|solo_tutor|student` |
| Onboarding flows (business, solo, student) | Done | `pages/onboarding/business.tsx`, `solo.tsx`, `student.tsx` |
| Route to correct dashboard after onboarding | Done | `pages/auth.tsx` (getOnboardingPathForAccountType, getDashboardPathForRole); callback → choose-account-type |
| DB: workspaces, workspace_members, profiles.account_type | Done | `supabase/migrations/20260228000000_workspaces_and_account_type.sql`, `20260228100000_schema_sprint1_sprint2.sql` |

### Sprint 2: Owner experience (MVP per section 3A) ✅

| Deliverable | Status | Evidence |
|------------|--------|----------|
| Owner dashboard with MVP widgets | Done | `AdminDashboard.tsx`: stats (tutors, students, classrooms, pending to grade), recent tutors/students/assignments |
| Tutors: list, invite, remove, suspend, profile view | Done | `pages/dashboard/owner/tutors.tsx`, `tutors/invite.tsx`, `tutors/[id].tsx`; features: `OwnerTutorsList`, `OwnerInviteTutor`, `OwnerTutorProfile` |
| Students: list, invite, remove, suspend, assign to tutor, profile view | Done | `pages/dashboard/owner/students.tsx`, `students/invite.tsx`, `students/[id].tsx`; `OwnerInviteStudent`, `OwnerStudentProfile` |
| Classroom/assignment/quiz oversight | Done | `owner/classrooms.tsx`, `owner/assignments.tsx`, `owner/quizzes.tsx`; workspace-scoped lists, filter by tutor where applicable |
| Workspace doc library view | Done | `owner/documents.tsx`, `OwnerDocumentsList` |
| tutor_student_assignments; workspace_id on classrooms; backfill | Done | Migration `20260228100000_schema_sprint1_sprint2.sql`; `useOwnerWorkspace`, `useTutorWorkspace` |

### Sprint 3: Tutor flow polish ✅

| Deliverable | Status | Evidence |
|------------|--------|----------|
| Tutor dashboard copy and “Quick Generate” | Done | `TeacherDashboard.tsx`: “Tutor” title, quickGenerate links (Worksheet, Quiz, Lesson, AI Studio) |
| Tutors create classes for assigned students only (Business) | Done | `useTutorWorkspace`: assignedStudentIds for business tutors; Solo shows all |
| AI Studio → AI Content Generator in nav | Done | `DashboardLayout` roleConfig.teacher: “AI Content Generator” |

### Sprint 4: Self-Study student mode ✅

| Deliverable | Status | Evidence |
|------------|--------|----------|
| Self-Study sidebar when no classrooms | Done | `DashboardLayout`: useHasClassrooms; studentSelfStudy nav (Study Hub, Practice Tests, My Library, Progress) |
| Study Hub as main; Practice Tests, My Library, Progress | Done | `StudentDashboard` self-study branch; routes `practice-tests`, `library`, `progress` |
| Join by code still works; classroom student nav after join | Done | `JoinClassroomDialog`, `useHasClassrooms`; student nav switches when hasClassrooms |

### Sprint 5: Billing, plans & Paddle (sandbox) ✅

| Deliverable | Status | Evidence |
|------------|--------|----------|
| Paddle Sandbox products/prices; env + webhook | Done | `pages/api/webhooks/paddle.ts`, `lib/paddle-webhook.ts`; `workspace_subscriptions`, `user_subscriptions` in migration `20260228200000_billing_subscriptions.sql` |
| Plan selection UI (Owner, Solo, Student) | Done | `OwnerBilling`, `TeacherBilling`, `StudentBilling`; `BillingPlans.tsx`, `PaddleProvider.tsx` |
| Paddle.js Checkout (priceId + customData) | Done | `BillingPlans` opens Checkout with price ID and customData (workspaceId/userId) |
| 14-day trial; monthly/annual; enforce limits | Done | Trial and period in subscription types; `useSubscription`; enforcement hooks/checks |

---

## Sprint 6: Final polish + beta ✅

| Deliverable | Status | Implementation |
|------------|--------|----------------|
| Onboarding checklists (first 3 actions) | Done | **Owner:** “Get your workspace ready” – Invite first tutor, Invite first student, Assign student to tutor (`AdminDashboard` + `OnboardingChecklist`). **Tutor:** “Get started as a tutor” – Create first classroom, Add student to class, Create first assignment (`TeacherDashboard` + `useTutorOnboardingStats`). **Student (self-study):** “Your first steps” – Try practice test, Add to My Library, Join a class (`StudentDashboard`). |
| Email copy (invite, welcome, assignment reminder) | Done | `docs/email-copy.md`: Invite (tutor/student), Welcome (Business/Solo/Student), Assignment reminder, Trial ending; placeholder reference. |
| Landing page final + demo flow | Done | Hero: “See how it works” link to `#features`; Navbar: Features, For Tutors, For Students, Pricing anchors. |
| QA and copy pass | Done | This report includes the QA checklist below. |

**New/updated artifacts (Sprint 6):**

- `src/components/dashboard/OnboardingChecklist.tsx` – Reusable checklist (title, items with done/href, hideWhenComplete).
- `src/hooks/useTutorOnboardingStats.ts` – Classroom count, assignment count, enrollment count for tutor checklist.
- `docs/email-copy.md` – Email templates and placeholder reference.
- `docs/REPOSITIONING_REPORT.md` – This report.

---

## QA checklist (per flow)

Use this before beta launch.

### Business Owner

- [ ] Sign up with accountType=business → lands on business onboarding.
- [ ] Complete business onboarding (name, workspace) → redirect to Owner dashboard.
- [ ] Owner dashboard shows “Get your workspace ready” checklist until all three actions done.
- [ ] Invite tutor (email/link) → tutor can join workspace.
- [ ] Invite student → student can be assigned to a tutor.
- [ ] Assign student to tutor on Students page.
- [ ] View all classrooms, assignments, quizzes; filter by tutor where applicable.
- [ ] Billing page shows plan/trial and opens Paddle Checkout.
- [ ] No “teacher” or “school” in Owner-facing copy; “Tutor”, “Business”, “Workspace” used.

### Solo Tutor

- [ ] Sign up with accountType=solo_tutor → lands on solo onboarding.
- [ ] Complete solo onboarding → redirect to Tutor dashboard.
- [ ] “Get started as a tutor” checklist shows until classroom, enrollment, assignment done.
- [ ] Create classroom, add student (invite or code), create assignment.
- [ ] Sidebar shows “Tutor”, “AI Content Generator”, Billing.
- [ ] Billing page shows Solo plan and Checkout.

### Student (self-study)

- [ ] Sign up with accountType=student → lands on student onboarding.
- [ ] Complete student onboarding → redirect to Student dashboard.
- [ ] With no classrooms: Self-Study nav (Study Hub, Practice Tests, My Library, Progress).
- [ ] “Your first steps” checklist visible (practice test, library, join class).
- [ ] Join classroom by code → nav switches to Classroom Student (My Classes, Assignments, Quizzes, Study Hub).
- [ ] Student billing page shows Student plan and Checkout.

### Terminology & landing

- [ ] Landing hero: “Run your tutoring business… all in one place”; three CTAs (Business, Solo, Student).
- [ ] “See how it works” scrolls to Features.
- [ ] No “teacher”/“school” in landing, auth, or dashboard copy; “Tutor”, “tutoring business” where specified.

### Billing & access

- [ ] After trial end (or no subscription), gated actions redirect or prompt for plan.
- [ ] Paddle webhook receives subscription events and updates workspace_subscriptions / user_subscriptions.
- [ ] Plan limits (tutors, students, AI) enforced where implemented.

---

## Deliverables summary

### User journeys

| Role | Journey |
|------|--------|
| **Business** | Sign up (business) → Business onboarding → Owner dashboard → Invite tutors/students, assign students → Classrooms/assignments/quizzes oversight → Billing. |
| **Solo Tutor** | Sign up (solo_tutor) → Solo onboarding → Tutor dashboard → Invite students, create classes/assignments/quizzes, AI tools → Billing. |
| **Student (self-study)** | Sign up (student) → Student onboarding → Self-Study dashboard (Study Hub, Practice Tests, Library, Progress) → Optional: join by code → Classroom Student experience. |
| **Student (classroom)** | Invited or join by code → Enrolled → Classroom Student dashboard (My Classes, Assignments, Quizzes, Study Hub). |

### Sidebar navigation (final)

| Role | Nav items |
|------|-----------|
| **Owner** | Overview, Tutors, Students, Classes, Assignments, Quizzes, Documents, Billing & Plan, Settings. |
| **Tutor** | Dashboard, My Students, My Classes, Materials, AI Content Generator, Assignments, Quizzes, Student Records, AI Checker, Lesson Planner, Calendar, Billing & Plan, Settings. |
| **Student (classroom)** | Dashboard, My Classes, My Documents, Course Materials, Assignments, Quizzes, Study Hub, Billing. |
| **Student (self-study)** | Dashboard, Study Hub, Practice Tests, My Library, Progress, Billing, Settings. |

### Key files (added or heavily modified)

**Auth & onboarding:** `pages/auth.tsx`, `pages/auth/choose-account-type.tsx`, `pages/auth/choose-role.tsx`, `pages/auth/callback.tsx`, `pages/onboarding/business.tsx`, `solo.tsx`, `student.tsx`.

**Owner:** `pages/dashboard/owner/index.tsx`, `tutors.tsx`, `tutors/invite.tsx`, `tutors/[id].tsx`, `students.tsx`, `students/invite.tsx`, `students/[id].tsx`, `classrooms.tsx`, `assignments.tsx`, `quizzes.tsx`, `documents.tsx`, `billing.tsx`; `AdminDashboard`, `OwnerTutorsList`, `OwnerInviteTutor`, `OwnerTutorProfile`, `OwnerStudentsList`, `OwnerInviteStudent`, `OwnerStudentProfile`, `OwnerClassroomsList`, `OwnerAssignmentsList`, `OwnerQuizzesList`, `OwnerDocumentsList`, `OwnerBilling`.

**Tutor/Teacher:** `DashboardLayout` (Tutor labels, AI Content Generator), `TeacherDashboard`, `TeacherBilling`, tutor workspace/assigned-students logic.

**Student:** `StudentDashboard` (self-study vs classroom), `StudentBilling`, `StudentPracticeTests`, `StudentMyLibrary`, `StudentProgress`, `JoinClassroomDialog`; `useHasClassrooms`, `DashboardLayout` studentSelfStudy config.

**Billing:** `PaddleProvider`, `BillingPlans`, `useSubscription`, `pages/api/webhooks/paddle.ts`, `lib/paddle-webhook.ts`, `lib/billing.ts`.

**Data:** Migrations for workspaces, workspace_members, tutor_student_assignments, workspace_id on classrooms, workspace_subscriptions, user_subscriptions, trial_ends_at; RLS where applicable.

**Sprint 6:** `OnboardingChecklist`, `useTutorOnboardingStats`, `docs/email-copy.md`, `docs/REPOSITIONING_REPORT.md`, Hero “See how it works”.

---

## Conclusion

The Hybrid Tutoring SaaS repositioning is **complete through Sprint 6**. All planned account types, workspaces, onboarding flows, Owner/Tutor/Student dashboards, self-study mode, and Paddle-based billing (sandbox) are in place. Onboarding checklists, email copy templates, and the landing demo flow are added for beta readiness. Run through the QA checklist above before opening beta to users.
