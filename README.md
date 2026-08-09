**Eduflow AI** is a vertical SaaS for tutoring centers, coaching institutes, and small–mid-sized schools that want to run their operations and teaching workflows in one place, powered by AI. It combines:

- **Operational OS** (classrooms, 1v1 rooms, sessions, billing, contracts, payouts, student records)
- **Teaching OS** (assignments, quizzes, documents, lesson planning, grading/checking)
- **AI OS** (Smart Tutor, AI checker, worksheet/lesson generators, AI credits and usage tracking)

…all wrapped in a multi‑role Next.js app (owner/admin, teacher, student) backed by Supabase, Paddle, and the OpenCode Go AI gateway.

---

### 1. Product overview (what it is)

- **Category**: B2B SaaS, “AI‑first LMS + tutoring center management”.
- **Core idea**: Run your tutoring/coaching business end‑to‑end—enrollment, timetables, content, assignments, grading, billing, payouts—while AI automates teacher work and gives students personalized support.
- **Architecture hints (from codebase)**:
  - Next.js 14 app with role‑based dashboards at `/dashboard/owner`, `/dashboard/teacher`, `/dashboard/student`.
  - Supabase for auth, data, storage (documents, assignments, submissions, contracts, invoices, etc.).
  - Paddle for billing, subscription management, and possibly teacher payouts.
  - AI features powered by the OpenCode Go plan (MiniMax, Kimi, GLM, DeepSeek): Smart Tutor, AI checker, lesson plan generation, worksheet/content generation.
  - Strong separation of **features by role** in `src/features/dashboard/{owner,teacher,student}` and reusable UI in `src/components`.

---

### 2. Target customers & personas

- **Primary customer (buyer) – “Owner/Admin”**
  - Small to mid‑size tutoring centers, coaching institutes, and hybrid/online academies.
  - Pain: fragmented tools (WhatsApp + Google Docs + Excel + separate accounting), manual fee tracking, no unified student records, difficult tracking of teacher performance and payouts.

- **Primary user – “Teacher/Tutor”**
  - Subject teachers and tutors delivering group classes or 1v1.
  - Pain: time‑consuming lesson prep, manual creation of assignments/quizzes/worksheets, manual grading, scattered communication and submissions.

- **End user – “Student”**
  - Middle school to university level students in coaching/tuition programs.
  - Pain: multiple channels to track tasks, poor visibility into assignments/grades, lack of structured materials and personalized help.

- **Secondary stakeholders**
  - **Parents** (viewing invoices/records indirectly, via exports/reports).
  - **Ops/Finance staff** (using owner billing, payouts, and finance modules).

---

### 3. Problems Eduflow AI solves

- **Operational chaos in tutoring centers**
  - Classes, 1v1 sessions, classrooms, rooms, and financials are scattered across spreadsheets, WhatsApp, and generic tools.
  - Hard to see per‑student financials, teacher payouts, and session‑level profitability.

- **Teacher workload & inconsistency**
  - Teachers manually:
    - Create assignments, quizzes, documents, worksheets.
    - Grade and give feedback.
    - Prepare lesson plans from syllabus.
  - Results in inconsistent quality and high burnout.

- **Student engagement and accountability**
  - Students are not sure:
    - What assignments are pending/overdue.
    - Where to get materials.
    - How they’re progressing over time.

- **No AI‑native workflows**
  - Most LMS/CRMs bolt AI on top; this product bakes AI into:
    - Lesson planning
    - Worksheet/content generation
    - Smart tutoring
    - Automated checking/grading assistance

---

### 4. Core product pillars & features

#### 4.1 Role‑based dashboards

- **Owner dashboard (`/dashboard/owner`)**
  - **Finance & billing**:
    - `OwnerFinance`, `OwnerBilling`, `OwnerPayouts`, `OwnerEarningRows` APIs.
    - Views for **students’ fee configs, invoices, payment proofs, payouts to tutors, and overall revenue**.
  - **Classrooms & 1v1 rooms**:
    - Owner‑level pages for `classrooms`, `rooms`, `student-records`, `tutors`.
    - Configures fee structures per student/class, manages sessions and attendance.
  - **Contracts & documents**:
    - Contracts module (new contract, contract detail, download/export PDF/DOC, sign, update body).
    - Documents section for central file storage and PDF operations (split, extract text, count pages).
  - **Workspace management**:
    - Owner workspace/settings (currency, subscription/plan, tenant user invites, student workspace access).

- **Teacher dashboard (`/dashboard/teacher`)**
  - **Assignments management**:
    - Teacher can create, publish, and delete assignments, attach documents, and view submissions.
    - Filters by classrooms and 1v1 rooms.
    - Status badges: draft, published, closed (with stats for totals/drafts/published).
  - **Quizzes & grading**:
    - Quizzes list, quiz builder, quiz results.
    - AI‑powered question generation (`AIGenerateQuestionsDialog`).
    - Student attempts: take, results, and teacher‑side result views.
  - **AI Studio**:
    - Smart Tutor (`/dashboard/teacher/ai-studio/smart-tutor`).
    - Worksheet/lesson content generators.
    - Rubric/AI checker presets and outputs.
    - AI credits usage display (`useAIUsage` showing current usage, limit, and remaining credits).
  - **Sessions & calendar**:
    - Sessions list, calendar integration (Google Calendar integration exists).
    - Session financial summaries per lecture/class.
  - **Billing & payouts**:
    - Teacher billing page with earnings overview.
    - Payouts API specifically scoped to teacher role.
  - **Documents & library**:
    - Teacher’s document center and AI‑enhanced doc tools (split/extract/attach to assignments).

- **Student dashboard (`/dashboard/student`)**
  - **Assignments view & submission**
    - `StudentAssignments` shows:
      - Pending vs submitted vs all.
      - Statuses: pending, due soon, overdue, submitted, graded (with badges).
      - Attachments and inline downloads from Supabase storage.
      - Submission via `SubmitAssignmentDialog` (with file uploads).
  - **Quizzes & practice tests**
    - Student can take quizzes (`/quizzes/[quizId]/take`, with attempts) and see results.
    - Practice tests section for self‑driven practice and maybe AI‑generated content.
  - **Courses & materials**
    - `course-materials`, `documents`, `library` pages.
  - **Billing**
    - Student billing page for invoices, payment status, and possibly payment proofs.
  - **Classrooms & rooms**
    - Student view of classrooms and 1v1 rooms they’re assigned to, with sessions and materials.

---

#### 4.2 AI‑powered teaching & learning

- **Smart Tutor**
  - Allows teachers to:
    - Upload documents or paste text.
    - Adapt content to different levels and learning needs.
    - Generate explanations, examples, or practice questions.
  - Tightly integrated with AI usage metering and history (AI Studio outputs).

- **AI Checker / auto‑grading assistance**
  - AI‑powered paper checker for free‑form answers or essays.
  - Rubric PDF generation and rubric presets, so grading can be consistent and partially automated.

- **AI content & worksheet generation**
  - Worksheet creator: generates structured question sets from syllabus or document input.
  - Lesson plan generator from syllabus (e.g. `lesson-plan-from-syllabus` API).
  - Possible extra AI tools in AI Studio for prompts, question banks, and remedial material.

- **AI credits & usage management**
  - Per‑workspace or per‑member AI credits tracked.
  - APIs to deduct credits and display historical usage.
  - Frontend shows **current usage / limit / remaining**, with visual bar and warnings when near limit.
  - This enables **tiered plans** and clear cost containment.

---

#### 4.3 Operations, billing, and finance

- **Subscriptions & plans**
  - App enforces:
    - Onboarding completion.
    - Required password change for security.
    - Active subscription check before allowing dashboard access.
  - `/select-plan` page and Paddle integration for hosted checkout/portal/session.

- **Student billing**
  - Fee configurations per student, invoices list, and submission of payment proofs.
  - APIs for student invoices and payment proof uploads.

- **Teacher payouts**
  - Owner view for calculating and approving payouts to tutors (earning rows APIs).
  - Teacher view for seeing their own earnings and payout status.

- **Contracts and compliance**
  - Contracts module with:
    - Contract templates / bodies.
    - Digital signature and status updates.
    - Export to PDF or DOC for formal/legal use.

- **Financial analytics**
  - Owner finance dashboards combining:
    - Student invoices.
    - Session/lecture financial summaries.
    - Tutor earning rows and payouts.
  - Potential to show **per‑student LTV, ARPU, and per‑teacher profitability**.

---

#### 4.4 Teaching workflows & content management

- **Sessions and lecture management**
  - Sessions list per classroom/room with:
    - Schedule, topic, lecturer, and financial summary.
  - 1v1 rooms vs group classrooms supported as first‑class entities.

- **Assignments & quizzes lifecycle**
  - For teachers:
    - Plan > create > attach documents > publish > collect submissions > view submissions > grade.
  - For students:
    - See “To Do / Submitted / All”, with clear due dates, points, and status.
    - Submit files, view grades, and see late tags.
  - Integrated with **Supabase storage** for documents and **AI tooling** for creation and feedback.

- **Documents & PDF tooling**
  - Central documents library with:
    - Upload.
    - Split PDF, extract text, count pages (for page‑based billing or print planning).
  - Integration with AI for turning documents into:
    - Worksheets.
    - Lesson plans.
    - Smart Tutor content.

---

### 5. Value proposition & positioning (marketing view)

#### 5.1 Core value propositions

- **“Run your entire tutoring center in one AI‑first platform.”**
  - From enrollment to exams to payouts, everything happens inside Eduflow AI.

- **“Save teachers 5–10 hours a week on prep and grading.”**
  - AI Smart Tutor, worksheet generator, and AI checker meaningfully reduce repetitive prep and marking.

- **“Give students clarity and a single source of truth.”**
  - One dashboard for assignments, quizzes, documents, and billing—no more scattered messages and PDFs.

- **“Make your finances transparent and predictable.”**
  - Built‑in fee configs, invoices, payment proofs, payouts, and finance dashboards.

#### 5.2 Differentiation vs generic LMS/CRMs

- **Vertically focused on tutoring/coaching** rather than generic K‑12 LMS.
- **Tight AI + finance integration**:
  - AI credits tied to subscriptions.
  - Finance and payouts integrated with teaching activity.
- **Multi‑role, end‑to‑end coverage**:
  - Few tools combine **(1) LMS**, **(2) CRM/finance**, and **(3) AI studio** in one product for this niche.

#### 5.3 Messaging angles

- **For owners**:
  - “Know exactly who owes what, who taught what, and what every session earned.”
  - “Grow your center without hiring a full ops team.”

- **For teachers**:
  - “Turn your syllabus and docs into ready‑to‑teach lessons and worksheets in minutes.”
  - “Spend time teaching, not formatting PDFs and calculating grades.”

- **For students/parents**:
  - “Never miss an assignment again, and always know where you stand.”

---

### 6. Business model & monetization (inferred)

- **SaaS subscriptions**:
  - Plans gated by:
    - AI usage/credits.
    - Number of students / classrooms / tutors.
    - Feature tiers (e.g. contracts, finance advanced features).
  - Managed via Paddle subscriptions and hosted billing portal.

- **Potential future revenue levers**:
  - **AI credit packs** (overage beyond plan).
  - **White‑label offering** for larger institutes.
  - **Premium analytics** (advanced finance, cohort outcomes, teacher performance).

---

### 7. Product maturity & technical foundation

- **Stack fit for serious SaaS**:
  - Next.js 14, React 18, TypeScript, shadcn‑ui, Tailwind.
  - Supabase for auth, Postgres, and file storage.
  - Paddle for billing and subscriptions.
  - Testing with Vitest and Testing Library.

- **Production‑grade UX patterns evident**:
  - Role‑based routing and `withAuth` wrapper.
  - Consistent dashboard layouts and cards, skeleton loading states, empty states.
  - Fine‑grained status badges and filters in assignments/finance views.

- **AI integration maturity**:
  - Centralized AI service, credit tracking, and usage bar UI.
  - Multiple distinct AI workflows (tutor, checker, worksheets, lesson plans), not just a single chat box.

---

### 8. Roadmap ideas (from marketing & product lens)

**Near‑term improvements**

- **Parent portal**:
  - View invoices, payment history, student assignments/grades, documents.
- **Engagement analytics**:
  - Student engagement scores (attendance, assignment completion, quiz performance).
- **More AI “auto‑flows”**:
  - Auto‑generate remedial practice for weak topics from quiz results.
  - Suggested next assignments based on Smart Tutor interactions.

**Mid‑term expansion**

- **Multi‑tenant academies and franchises**:
  - Roll‑up reporting across branches.
  - Centralized content libraries shared across multiple centers.
- **Integrations**:
  - WhatsApp/Email task reminders for pending/overdue assignments.
  - Deeper calendar sync and attendance tracking.

**Long‑term vision**

- Become the **default operating system for AI‑powered tutoring businesses**, where:
  - Every session, assignment, quiz, and invoice is data‑driven.
  - AI continuously supports both **teachers** (planning, grading) and **students** (personalized explanations and practice).