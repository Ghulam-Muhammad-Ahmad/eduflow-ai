# EduFlow AI — System Specification Document

> **Version:** 1.0.0
> **Last Updated:** 2026-03-24
> **Product:** EduLabLoom EduFlow AI
> **Repository:** `edulabloom/eduflow-ai`

This document is the authoritative specification for the EduFlow AI codebase. It describes every layer of the system — from infrastructure and database schema through to frontend routing, business logic, and AI integrations — in sufficient detail for any developer or AI agent to understand, modify, or extend the platform.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Environment Variables](#4-environment-variables)
5. [Configuration Files](#5-configuration-files)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [Roles, Account Types & Workspace Model](#7-roles-account-types--workspace-model)
8. [Database Schema](#8-database-schema)
9. [Row-Level Security (RLS) Policies](#9-row-level-security-rls-policies)
10. [Database Functions & Triggers](#10-database-functions--triggers)
11. [Storage Buckets & Policies](#11-storage-buckets--policies)
12. [Frontend Routing](#12-frontend-routing)
13. [API Routes](#13-api-routes)
14. [State Management & Data Fetching](#14-state-management--data-fetching)
15. [Hooks Reference](#15-hooks-reference)
16. [AI System](#16-ai-system)
17. [Billing & Subscriptions (Paddle)](#17-billing--subscriptions-paddle)
18. [Credits & Storage Quotas](#18-credits--storage-quotas)
19. [Contracts & Financial Engine](#19-contracts--financial-engine)
20. [Google Calendar Integration](#20-google-calendar-integration)
21. [Document Management](#21-document-management)
22. [Assignments & Submissions](#22-assignments--submissions)
23. [Quizzes](#23-quizzes)
24. [Sessions & Scheduling](#24-sessions--scheduling)
25. [UI Component Library](#25-ui-component-library)
26. [Design System & Brand](#26-design-system--brand)
27. [Form Handling & Validation](#27-form-handling--validation)
28. [PDF & Document Generation](#28-pdf--document-generation)
29. [Cron Jobs](#29-cron-jobs)
30. [Migration History](#30-migration-history)
31. [Testing](#31-testing)
32. [Key Architectural Decisions](#32-key-architectural-decisions)

---

## 1. Product Overview

EduFlow AI is a **multi-tenant education management platform** designed for tutoring businesses, solo tutors, and students. It provides:

- **Workspace management** — Owners create workspaces, invite tutors and students, manage billing and contracts.
- **Classroom & 1-on-1 rooms** — Tutors organize students into group classrooms or private 1-on-1 rooms.
- **Assignments & Quizzes** — Teachers create, publish, and grade assignments and quizzes; students submit and take them.
- **AI Studio** — AI-powered tools for generating rubrics, exam papers, worksheets, lesson plans, study materials, quiz questions, and grading submissions (OpenCode Go).
- **Document Center** — File uploads, folder management, document sharing to classrooms/rooms, and storage quotas.
- **Session Scheduling** — Calendar-based scheduling with Google Calendar sync, recurring sessions, and session financials.
- **Billing & Finance** — Paddle subscription billing for workspaces; tutor contracts with hourly/per-session/fixed-monthly pay; student fee configs and invoicing; payment proof uploads.
- **AI Credit System** — Monthly credit pools allocated per subscription plan, assignable to workspace members.

### User Personas

| Persona | App Role | Account Type | Description |
|---------|----------|--------------|-------------|
| **Owner** | `admin` | `business` | Creates a workspace, subscribes to a plan, invites tutors and students, manages billing/finance/contracts |
| **Tutor** | `teacher` | `tutor` | Invited by an owner (or self-registered as solo); teaches classrooms and 1-on-1 rooms; uses AI tools |
| **Student** | `student` | `student` | Invited by an owner or self-registered; joins classrooms, takes quizzes, submits assignments |
| **Solo Tutor** | `admin` | `business` | An owner who also tutors (workspace type `solo`); has both owner and teacher capabilities |

---

## 2. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Framework** | Next.js (Pages Router) | 14.2.x |
| **Language** | TypeScript | 5.8.x |
| **React** | React + ReactDOM | 18.3.x |
| **Styling** | Tailwind CSS + tailwindcss-animate + @tailwindcss/typography | 3.4.x |
| **UI Primitives** | Radix UI (30+ components) | latest |
| **UI System** | shadcn/ui pattern (components.json + CVA) | — |
| **Icons** | Lucide React | 0.462.x |
| **Data Fetching** | TanStack React Query | v5.83.x |
| **Forms** | react-hook-form + @hookform/resolvers | 7.61.x |
| **Validation** | Zod | 3.25.x |
| **Database / Auth** | Supabase (supabase-js + SSR) | 2.90.x / 0.8.x |
| **AI** | OpenCode Go (Zen) gateway via OpenAI-compatible SDK | 6.16.x |
| **Billing** | Paddle (checkout, webhooks, portal) | via REST API |
| **PDF Generation** | jspdf + jspdf-autotable, pdf-lib, html2canvas | — |
| **Document Parsing** | pdf-parse, mammoth | — |
| **Word Export** | docx | 9.6.x |
| **Markdown** | react-markdown + remark-gfm + remark-math + rehype-katex | — |
| **Math Rendering** | KaTeX | 0.16.x |
| **Calendar UI** | react-big-calendar | 1.19.x |
| **Charts** | Recharts | 2.15.x |
| **Dates** | date-fns | 3.6.x |
| **Email** | nodemailer | 8.0.x |
| **File Uploads** | react-dropzone | 14.3.x |
| **Testing** | Vitest + Testing Library + jsdom | 3.2.x |
| **Linting** | ESLint + eslint-config-next | — |

### No Global State Library

The app uses **React Context** (for auth, onboarding state) and **TanStack React Query** (for server state). There is no Redux, Zustand, Jotai, or similar global store.

---

## 3. Project Structure

```
eduflow-ai/
├── pages/                          # Next.js Pages Router
│   ├── _app.tsx                    # App wrapper (QueryClient, AuthProvider, Toasters)
│   ├── index.tsx                   # Landing page
│   ├── 404.tsx                     # Not found
│   ├── auth.tsx                    # Sign in / forgot password
│   ├── auth/
│   │   ├── register.tsx            # Sign up
│   │   ├── callback.tsx            # OAuth/magic link callback
│   │   └── choose-role.tsx         # Post-OAuth role selection
│   ├── reset-password.tsx          # Password reset
│   ├── checkout.tsx                # Paddle checkout
│   ├── select-plan.tsx             # Plan selection
│   ├── onboarding/
│   │   ├── business.tsx            # Owner onboarding
│   │   ├── solo.tsx                # Solo tutor onboarding
│   │   ├── student.tsx             # Student onboarding
│   │   └── change-password.tsx     # Forced password change for invited users
│   ├── dashboard/
│   │   ├── settings.tsx            # User settings
│   │   ├── admin/[...slug].tsx     # Owner catch-all (redirects)
│   │   ├── owner/                  # Owner dashboard (20+ pages)
│   │   ├── teacher/                # Teacher dashboard (30+ pages)
│   │   └── student/                # Student dashboard (15+ pages)
│   └── api/                        # API routes (50 handlers)
│       ├── ai/                     # AI generation endpoints
│       ├── contracts/              # Contract operations
│       ├── credits/                # Credit management
│       ├── documents/              # Document extraction/splitting
│       ├── google/                 # Google OAuth
│       ├── owner/                  # Owner-specific APIs
│       ├── paddle/                 # Paddle billing
│       ├── payment-proofs/         # Payment proof URLs
│       ├── sessions/               # Session CRUD
│       ├── storage/                # Storage allocation
│       ├── student/                # Student invoices
│       ├── teacher/                # Teacher earnings/payouts
│       ├── tenant/                 # User creation/invites
│       ├── webhooks/               # Paddle webhooks
│       └── workspace/              # Workspace settings
├── src/
│   ├── components/
│   │   ├── ui/                     # shadcn/ui primitives (40+ components)
│   │   ├── dashboard/              # DashboardLayout, OnboardingChecklist
│   │   ├── ai/                     # AI Studio UI components
│   │   ├── billing/                # Billing UI
│   │   ├── credits/                # Credits UI
│   │   ├── storage/                # Storage UI
│   │   ├── lectures/               # Session/lecture components
│   │   ├── quiz/                   # Quiz components
│   │   ├── student/                # Student-specific components
│   │   └── teacher/                # Teacher-specific components
│   ├── features/
│   │   ├── dashboard/
│   │   │   ├── owner/              # Owner feature screens
│   │   │   ├── teacher/            # Teacher feature screens
│   │   │   ├── student/            # Student feature screens
│   │   │   └── shared/             # Shared components
│   │   ├── NotFound.tsx
│   │   └── ResetPassword.tsx
│   ├── hooks/                      # 35+ custom hooks
│   ├── integrations/supabase/
│   │   ├── client.ts               # Browser Supabase client
│   │   ├── server.ts               # Server Supabase client (cookie-based SSR)
│   │   ├── admin.ts                # Service role client (bypasses RLS)
│   │   └── types.ts                # Generated Database types
│   ├── lib/                        # Utilities and business logic
│   ├── server/                     # Server-only modules
│   │   ├── billing/                # Fee engine, contract engine, financial summary
│   │   ├── google-calendar.ts      # Google Calendar API
│   │   ├── lecture-sessions.ts     # Session management
│   │   └── storage-allocation.ts   # Storage quota logic
│   ├── services/
│   │   └── aiService.ts            # Client-side AI service
│   ├── types/                      # Type definitions
│   ├── test/                       # Test setup
│   └── index.css                   # Global styles + Tailwind directives
├── supabase/
│   ├── config.toml                 # Supabase CLI config
│   └── migrations/                 # 12 SQL migrations
├── public/                         # Static assets (logos, fonts, icons)
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
├── postcss.config.js
├── components.json                 # shadcn/ui configuration
└── .eslintrc.json
```

---

## 4. Environment Variables

### Public (Client-exposed via `NEXT_PUBLIC_` prefix)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Fallback alias for anon key |
| `NEXT_PUBLIC_APP_URL` | Application base URL (used for invite links) |
| `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` | Paddle client-side token |
| `NEXT_PUBLIC_PADDLE_ENVIRONMENT` | `sandbox` or `production` (default: sandbox) |
| `NEXT_PUBLIC_PADDLE_PRICE_BUSINESS_BASIC_MONTHLY` | Paddle price ID |
| `NEXT_PUBLIC_PADDLE_PRICE_BUSINESS_BASIC_ANNUAL` | Paddle price ID |
| `NEXT_PUBLIC_PADDLE_PRICE_BUSINESS_PRO_MONTHLY` | Paddle price ID |
| `NEXT_PUBLIC_PADDLE_PRICE_BUSINESS_PRO_ANNUAL` | Paddle price ID |
| `NEXT_PUBLIC_PADDLE_PRICE_BUSINESS_PLUS_MONTHLY` | Paddle price ID |
| `NEXT_PUBLIC_PADDLE_PRICE_BUSINESS_PLUS_ANNUAL` | Paddle price ID |

### Server-only

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENCODE_API_KEY` | OpenCode Go subscription API key (`sk-…`) | — |
| `OPENCODE_BASE_URL` | OpenCode Go gateway base URL | `https://opencode.ai/zen/go/v1` |
| `OPENCODE_MODEL_GENERAL` | Model for prose generation | `kimi-k3` |
| `OPENCODE_MODEL_REASONING` | Model for grading/evaluation | `deepseek-v4-pro` |
| `OPENCODE_MODEL_STRUCTURED` | Model for JSON output | `glm-5.2` |
| `OPENCODE_MODEL_LONG_CONTEXT` | Model for very large prompts | `minimax-m3` |
| `OPENCODE_MODEL_FAST` | Model for short, low-stakes calls | `deepseek-v4-flash` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (bypasses RLS) | — |
| `PADDLE_API_KEY` | Paddle server API key | — |
| `PADDLE_WEBHOOK_SECRET` | Paddle webhook verification secret | — |
| `AI_CREDITS_BUSINESS_BASIC` | Monthly AI credits for Basic plan | `300` |
| `AI_CREDITS_BUSINESS_PRO` | Monthly AI credits for Pro plan | `1200` |
| `AI_CREDITS_BUSINESS_PLUS` | Monthly AI credits for Plus plan | `3000` |
| `AI_CREDITS_DEFAULT` | Default credits (no subscription) | `0` |
| `AI_CREDIT_WEIGHT_*` | Per-feature credit cost (e.g. `AI_CREDIT_WEIGHT_CHECKER`, `AI_CREDIT_WEIGHT_MODEL_TEST`) | `1` each |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID (Calendar integration) | — |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | — |
| `GOOGLE_OAUTH_REDIRECT_URI` | Google OAuth redirect URI | — |

---

## 5. Configuration Files

### `next.config.js`

- `reactStrictMode: true`
- `swcMinify: true`
- `images.domains: []`
- Injects `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` into `env` (public values only — `env` entries are inlined into the client bundle, so server secrets must not be listed there)
- `eslint.ignoreDuringBuilds: true`

### `tsconfig.json`

- Path alias: `@/*` → `./src/*`
- Strict TypeScript enabled
- Next.js plugin included

### `tailwind.config.ts`

- Content paths: `./pages/**/*`, `./src/**/*`
- Custom brand colors: `ink-black`, `medium-slate-blue`, `slime-lime`, `dust-grey`, `platinum`
- CSS variable-based semantic colors (shadcn pattern)
- SF Pro Display font family
- Custom animations: accordion, premium-pulse, glow, shimmer
- Custom shadows: subtle, medium, large, glow, glow-purple
- Custom gradients: gradient-primary, gradient-premium, gradient-dark, gradient-hero
- Plugins: `tailwindcss-animate`, `@tailwindcss/typography`

### `components.json` (shadcn/ui)

- Style: "new-york"
- CSS variables: enabled
- Path aliases configured to `@/components`, `@/lib/utils`, `@/hooks`

---

## 6. Authentication & Authorization

### Auth Provider (`src/hooks/useAuth.tsx`)

The `AuthProvider` wraps the entire app and provides auth context via `useAuth()`. It uses `@supabase/ssr` browser client with cookie-based sessions.

**Context value:**

| Field | Type | Description |
|-------|------|-------------|
| `user` | `User \| null` | Supabase auth user |
| `role` | `AppRole \| null` | From `user_roles` table |
| `profile` | `Profile \| null` | From `profiles` table (display_name, avatar_url, bio, account_type, etc.) |
| `isLoading` | `boolean` | Auth state loading |
| `signIn` | `(email, password) => Promise` | Email/password sign in |
| `signUp` | `(email, password, metadata?) => Promise` | Email/password sign up |
| `signOut` | `() => Promise` | Sign out |
| `resetPassword` | `(email) => Promise` | Send password reset email |
| `updatePassword` | `(password) => Promise` | Update user password |
| `updateEmail` | `(email) => Promise` | Update user email |
| `updateProfile` | `(updates) => Promise` | Update `profiles` row |

**Auth flow:**

1. User signs up with email/password (or OAuth). Supabase `auth.users` trigger (`handle_new_user`) auto-creates a row in `profiles` and `user_roles`.
2. On `onAuthStateChange`, the app loads the user's `role` from `user_roles` and `profile` from `profiles`.
3. For OAuth users, `ensureOAuthUserProfile` upserts the profile row, and `setRoleForOAuthUser` / `setAccountTypeForOAuthUser` insert into `user_roles` / update `profiles.account_type`.

### Route Guard (`src/lib/withAuth.tsx`)

A higher-order component that protects dashboard pages:

1. Redirects unauthenticated users to `/auth`
2. Enforces `allowedRoles` — wrong role redirects to role-specific dashboard
3. **Forced password change**: Teachers and students with `password_changed_at === null` (invited users) are redirected to `/onboarding/change-password`
4. **Onboarding gate**: Incomplete onboarding (no `onboarding_completed_at`) redirects to `/onboarding/business`, `/onboarding/student`, or solo tutor flow
5. **Subscription gate**: Uses `useHasActiveSubscription` hook; no subscription redirects to `/select-plan`

### Server-side Auth (`src/integrations/supabase/server.ts`)

- `getAuthUser(req, res)` creates a server Supabase client using cookie-based `getAll`/`setAll` (supports chunked auth cookies)
- Returns `supabase.auth.getUser()` — API routes should **never** trust `userId` from the request body

### Admin Client (`src/integrations/supabase/admin.ts`)

- Service role client that **bypasses RLS** — used in webhooks and privileged API routes only
- Must never run in the browser

---

## 7. Roles, Account Types & Workspace Model

### App Roles (`user_roles.role`)

| Role | UI Label | Description |
|------|----------|-------------|
| `admin` | Owner | Workspace owners who manage the business |
| `teacher` | Tutor | Tutors who teach in classrooms and 1-on-1 rooms |
| `student` | Student | Students who learn and submit work |

### Account Types (`profiles.account_type`)

| Type | Description |
|------|-------------|
| `business` | Owner who created a workspace (self-registered) |
| `tutor` | Tutor invited by an owner |
| `student` | Student (self-registered or invited) |

### Workspace Model

```
Owner (admin/business)
└── Workspace (business or solo type)
    ├── workspace_members (owner + invited tutors)
    ├── workspace_students (students linked to workspace)
    ├── workspace_subscriptions (Paddle subscription)
    ├── workspace_credit_pools (monthly AI credit pool)
    ├── tutor_contracts (one active contract per tutor)
    ├── classrooms (group teaching)
    │   ├── classroom_tutors (tutors assigned to classroom)
    │   └── enrollments (students enrolled)
    └── one_to_one_rooms (1-on-1 tutor-student pairs)
```

**Workspace types:**
- `business` — Owner with multiple tutors and students
- `solo` — Solo tutor acting as both owner and tutor

**Workspace member roles** (`workspace_members.role`):
- `owner` — The workspace creator
- `tutor` — An invited tutor

**Key relationships:**
- `tutor_student_assignments` — Explicit tutor-to-student mapping within a workspace
- Students access workspaces via `workspace_students` (tenant-level) and `enrollments` (classroom-level)
- Tutors access via `workspace_members` and `classroom_tutors`

---

## 8. Database Schema

**Database:** PostgreSQL 17.6.1 on Supabase
**Region:** `ap-south-1`
**Custom Enum:** `app_role` = `teacher`, `student`, `admin`
**Extensions:** `plpgsql`, `pg_graphql`, `pg_stat_statements`, `pgcrypto`, `uuid-ossp`, `supabase_vault`, `pg_cron`

### 8.1 Core Identity

#### `profiles`
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `user_id` | uuid | NO | | UNIQUE, FK → `auth.users.id` |
| `display_name` | text | YES | | |
| `avatar_url` | text | YES | | |
| `email` | text | YES | | |
| `account_type` | text | YES | | CHECK: `business`, `student`, `tutor` |
| `bio` | text | YES | | |
| `onboarding_completed_at` | timestamptz | YES | | |
| `password_changed_at` | timestamptz | YES | `now()` | null for invited users |
| `created_at` | timestamptz | NO | `now()` | |
| `updated_at` | timestamptz | NO | `now()` | |

#### `user_roles`
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `user_id` | uuid | NO | | UNIQUE, FK → `auth.users.id` |
| `role` | app_role | NO | | `teacher`/`student`/`admin` |
| `created_at` | timestamptz | NO | `now()` | |

### 8.2 Workspaces

#### `workspaces`
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `name` | text | NO | | |
| `type` | text | NO | | CHECK: `business`, `solo` |
| `owner_id` | uuid | NO | | FK → `auth.users.id` |
| `settings` | jsonb | NO | `'{}'` | |
| `trial_ends_at` | timestamptz | YES | | |
| `logo_url` | text | YES | | |
| `created_at` | timestamptz | NO | `now()` | |
| `updated_at` | timestamptz | NO | `now()` | |

#### `workspace_members`
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `workspace_id` | uuid | NO | | FK → `workspaces.id` |
| `user_id` | uuid | NO | | FK → `auth.users.id` |
| `role` | text | NO | | CHECK: `owner`, `tutor` |
| `created_at` | timestamptz | NO | `now()` | |

UNIQUE: `(workspace_id, user_id)`

#### `workspace_students`
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `workspace_id` | uuid | NO | | PK (composite), FK → `workspaces.id` |
| `student_id` | uuid | NO | | PK (composite), FK → `auth.users.id` |
| `created_at` | timestamptz | NO | `now()` | |

#### `tutor_student_assignments`
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `workspace_id` | uuid | NO | | FK → `workspaces.id` |
| `tutor_id` | uuid | NO | | FK → `auth.users.id` |
| `student_id` | uuid | NO | | FK → `auth.users.id` |
| `created_at` | timestamptz | NO | `now()` | |

UNIQUE: `(workspace_id, student_id)`

### 8.3 Classrooms & 1-on-1 Rooms

#### `classrooms`
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `teacher_id` | uuid | NO | | FK → `auth.users.id` |
| `workspace_id` | uuid | YES | | FK → `workspaces.id` |
| `name` | text | NO | | |
| `subject` | text | YES | | |
| `join_code` | text | YES | | |
| `settings` | jsonb | YES | `'{"allow_late_submissions": true}'` | |
| `is_archived` | boolean | YES | `false` | |
| `created_at` | timestamptz | NO | `now()` | |
| `updated_at` | timestamptz | NO | `now()` | |

#### `classroom_tutors`
PK: `(classroom_id, user_id)` — Maps multiple tutors to a classroom.

#### `enrollments`
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `classroom_id` | uuid | NO | | FK → `classrooms.id` |
| `student_id` | uuid | NO | | FK → `auth.users.id` |
| `status` | text | NO | `'active'` | CHECK: `active`, `left`, `removed` |
| `joined_at` | timestamptz | NO | `now()` | |
| `left_at` | timestamptz | YES | | |

UNIQUE: `(classroom_id, student_id)`

#### `one_to_one_rooms`
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `workspace_id` | uuid | NO | | FK → `workspaces.id` |
| `tutor_id` | uuid | NO | | FK → `auth.users.id` |
| `student_id` | uuid | NO | | FK → `auth.users.id` |
| `name` | text | YES | | |
| `created_at` | timestamptz | NO | `now()` | |
| `updated_at` | timestamptz | NO | `now()` | |

UNIQUE: `(workspace_id, tutor_id, student_id)`

### 8.4 Assignments & Submissions

#### `assignments`
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `classroom_id` | uuid | YES | | FK → `classrooms.id` |
| `one_to_one_room_id` | uuid | YES | | FK → `one_to_one_rooms.id` |
| `teacher_id` | uuid | NO | | FK → `auth.users.id` |
| `title` | text | NO | | |
| `description` | text | YES | | |
| `instructions` | text | YES | | |
| `due_date` | timestamptz | YES | | |
| `points_possible` | int4 | YES | `100` | |
| `allow_late_submission` | boolean | YES | `true` | |
| `status` | text | NO | `'draft'` | CHECK: `draft`, `published`, `closed`, `graded` |
| `published_at` | timestamptz | YES | | |
| `created_at` | timestamptz | NO | `now()` | |
| `updated_at` | timestamptz | NO | `now()` | |

CHECK: Exactly one of `classroom_id` or `one_to_one_room_id` must be non-null.

#### `assignment_attachments`
Links assignments to documents. UNIQUE: `(assignment_id, document_id)`.

#### `submissions`
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `assignment_id` | uuid | NO | | FK → `assignments.id` |
| `student_id` | uuid | NO | | FK → `auth.users.id` and `profiles.user_id` |
| `file_path` | text | YES | | Path in `submissions` storage bucket |
| `file_name` | text | YES | | |
| `text_content` | text | YES | | |
| `submitted_at` | timestamptz | NO | `now()` | |
| `is_late` | boolean | YES | `false` | |
| `grade` | numeric | YES | | |
| `feedback` | text | YES | | |
| `status` | text | NO | `'submitted'` | CHECK: `submitted`, `graded`, `returned` |
| `graded_at` | timestamptz | YES | | |
| `returned_at` | timestamptz | YES | | |

UNIQUE: `(assignment_id, student_id)`

### 8.5 Quizzes

#### `quizzes`
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `classroom_id` | uuid | YES | | FK → `classrooms.id` |
| `one_to_one_room_id` | uuid | YES | | FK → `one_to_one_rooms.id` |
| `teacher_id` | uuid | NO | | FK → `auth.users.id` |
| `title` | text | NO | | |
| `description` | text | YES | | |
| `instructions` | text | YES | | |
| `time_limit_minutes` | int4 | YES | | |
| `available_from` | timestamptz | YES | | |
| `available_until` | timestamptz | YES | | |
| `passing_score` | numeric | YES | | |
| `max_attempts` | int4 | YES | `1` | |
| `randomize_questions` | boolean | YES | `false` | |
| `show_correct_answers` | boolean | YES | `true` | |
| `show_results_immediately` | boolean | YES | `true` | |
| `status` | text | NO | `'draft'` | CHECK: `draft`, `scheduled`, `active`, `closed` |
| `published_at` | timestamptz | YES | | |

CHECK: Exactly one of `classroom_id` or `one_to_one_room_id` must be non-null.

#### `quiz_questions`
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `quiz_id` | uuid | NO | | FK → `quizzes.id` |
| `question_type` | text | NO | | CHECK: `multiple_choice`, `true_false`, `short_answer` |
| `question_text` | text | NO | | |
| `points` | numeric | NO | `1.0` | |
| `order_index` | int4 | NO | `0` | |
| `options` | jsonb | YES | | Array of `{text, is_correct}` for MCQ |
| `correct_answer` | text | YES | | |
| `explanation` | text | YES | | |

#### `quiz_attempts`
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `quiz_id` | uuid | NO | | FK → `quizzes.id` |
| `student_id` | uuid | NO | | FK → `auth.users.id` |
| `attempt_number` | int4 | NO | `1` | |
| `started_at` | timestamptz | NO | `now()` | |
| `submitted_at` | timestamptz | YES | | |
| `time_spent_seconds` | int4 | YES | | |
| `answers` | jsonb | NO | `'[]'` | Array of student answers |
| `score` | numeric | YES | | |
| `points_earned` | numeric | YES | | |
| `points_possible` | numeric | YES | | |
| `status` | text | NO | `'in_progress'` | CHECK: `in_progress`, `submitted`, `graded` |

### 8.6 Documents

#### `documents`
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `user_id` | uuid | NO | | |
| `folder_id` | uuid | YES | | FK → `folders.id` |
| `name` | text | NO | | |
| `file_path` | text | NO | | Path in storage |
| `file_size` | bigint | NO | `0` | |
| `file_type` | text | NO | | |

#### `folders`
Self-referencing tree: `parent_id` FK → `folders.id`.

#### `tags` / `document_tags`
User-owned tags with colors. Many-to-many link to documents. UNIQUE: `(user_id, name)` on tags, `(document_id, tag_id)` on document_tags.

#### `document_classroom_shares` / `document_one_to_one_room_shares`
Share documents to classrooms or 1-on-1 rooms. UNIQUE constraints prevent duplicate shares.

### 8.7 AI Tables

#### `ai_interactions`
Records every AI API call: user, type, provider, model, tokens, cost, credits_deducted, request/response data, success status.

**Interaction types:** `content_generation`, `grading`, `lesson_planning`, `study_materials`, `rubric_generation`, `quiz_questions`, `differentiation`, `concept_explanation`, `practice_questions`, `flashcards`, `study_plan`, `worksheet_generation`, `paper_generation`, `checker`, `contract_generation`, `contract_revision`.

#### `ai_generated_content`
Stores generated content (lesson plans, worksheets, papers, rubrics, etc.) as JSON with metadata. Can be linked to a saved document (`document_id`).

**Content types:** `lesson_plan`, `syllabus_lesson_plan`, `worksheet`, `worksheet_builder`, `discussion_questions`, `project_ideas`, `rubric`, `paper`, `quiz_questions`, `study_notes`, `flashcards`, `practice_questions`, `summary`, `concept_explanation`, `study_plan`.

#### `ai_feedback`
Stores AI-generated feedback on submissions: structured feedback_data, suggestions, rubric_suggestions, acceptance status.

#### `user_ai_usage`
Monthly usage tracking per user: interactions_count, tokens_used, cost, limit_reached. UNIQUE: `(user_id, month)`.

### 8.8 Checker & Source Documents

#### `checker_presets`
Teacher-owned presets for the AI checker: name, instructions, rubric_categories (jsonb), total_points, optional reference_document_id.

#### `source_documents`
Teacher-owned reference documents: file info, document_type (`rubric`, `answer_key`, `example_paper`, `reference`).

#### `checked_papers`
Records of AI-checked papers: teacher_id, classroom_id, optional student_id, title, file_path, grade, feedback_text, instructions used.

### 8.9 Sessions & Scheduling

#### `sessions`
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `workspace_id` | uuid | NO | | FK → `workspaces.id` |
| `classroom_id` | uuid | YES | | FK → `classrooms.id` |
| `tutor_id` | uuid | NO | | FK → `auth.users.id` |
| `created_by_user_id` | uuid | NO | | FK → `auth.users.id` |
| `student_id` | uuid | YES | | FK (for 1-on-1 sessions) |
| `series_id` | uuid | YES | | FK → `session_series.id` |
| `occurrence_index` | int4 | YES | | |
| `title` | text | NO | | |
| `description` | text | YES | | |
| `starts_at` | timestamptz | NO | | |
| `ends_at` | timestamptz | NO | | |
| `status` | text | NO | `'scheduled'` | CHECK: `scheduled`, `cancelled`, `completed` |
| `scope_type` | text | NO | `'classroom'` | CHECK: `classroom`, `one_to_one` |
| `meeting_provider` | text | NO | `'google_meet'` | CHECK: `google_meet`, `manual` |
| `meeting_url` | text | YES | | |
| `external_event_id` | text | YES | | Google Calendar event ID |
| `google_calendar_id` | text | YES | | |
| `completed_at` | timestamptz | YES | | |
| `completed_by_user_id` | uuid | YES | | |

#### `session_series`
Recurring session definition: recurrence_frequency (`daily`/`weekly`), interval, occurrences_count.

#### `session_notes`
Notes attached to sessions.

#### `google_calendar_connections`
One per user. Stores OAuth tokens, google_email, calendar_id for Google Calendar sync.

#### `planner_events`
Teacher-owned personal calendar events (not tied to sessions).

### 8.10 Subscriptions & Credits

#### `workspace_subscriptions`
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `workspace_id` | uuid | NO | | UNIQUE, FK → `workspaces.id` |
| `paddle_subscription_id` | text | YES | | |
| `paddle_customer_id` | text | YES | | |
| `price_id` | text | YES | | Paddle price ID |
| `status` | text | NO | `'inactive'` | CHECK: `active`, `trialing`, `past_due`, `canceled`, `inactive` |
| `current_period_ends_at` | timestamptz | YES | | |
| `trial_ends_at` | timestamptz | YES | | |
| `doc_storage_limit_mb` | int4 | YES | | |

#### `user_subscriptions`
Same structure as workspace_subscriptions but per-user (for students with own subscriptions).

#### `workspace_credit_pools`
Monthly credit pool per workspace. UNIQUE: `(workspace_id, period)`.
- `credits_allocated` — Total credits for the period
- `credits_assigned_out` — Credits assigned to members
- `credits_used_direct` — Credits used by owner directly

#### `user_credit_allocations`
Per-user credit allocation per period. UNIQUE: `(user_id, period, source_type, source_id)`.
- `source_type`: `subscription` or `workspace`
- `credits_limit` / `credits_used`

#### `credit_assignments_audit`
Audit log for credit assignment/update actions.

#### `user_storage_allocations`
Per-user storage quota within a workspace. UNIQUE: `(workspace_id, user_id)`.

### 8.11 Contracts & Billing

#### `tutor_contracts`
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `workspace_id` | uuid | NO | | FK → `workspaces.id` |
| `tutor_id` | uuid | NO | | FK → `auth.users.id` |
| `contract_status` | text | NO | `'draft'` | CHECK: `draft`, `pending_signature`, `signed`, `change_requested` |
| `pay_type` | text | NO | `'hourly'` | CHECK: `hourly`, `per_session`, `fixed_monthly` |
| `rate_amount` | numeric | NO | `0` | |
| `rate_currency` | text | NO | `'GBP'` | |
| `subjects` | jsonb | NO | `'[]'` | |
| `contract_body_text` | text | YES | | Rich text body |
| `contract_storage_path` | text | YES | | Signed PDF path |
| `contract_signed_at` | timestamptz | YES | | |
| `tutor_signature_name` | text | YES | | |
| `owner_signature_name` | text | YES | | |
| `owner_signed_at` | timestamptz | YES | | |
| `change_requested_at` | timestamptz | YES | | |
| `change_request_note` | text | YES | | |
| `platform_fee_pct` | numeric(5,2) | YES | `0` | |
| `start_date` | date | YES | `CURRENT_DATE` | |
| `end_date` | date | YES | | |
| `status` | text | YES | `'active'` | CHECK: `active`, `paused`, `ended` |

Partial unique index: `(workspace_id, tutor_id) WHERE status = 'active'` — at most one active contract per tutor per workspace.

#### `tutor_earning_rows`
Individual earning records for tutors: `earning_type` (`session`/`monthly_salary`), amounts (gross, platform_fee, net), status (`pending`/`approved`/`paid`), linked to payout.

#### `tutor_payouts`
Payout records: total_net_amount, status (`pending`/`paid`), proof_storage_path.

#### `student_fee_configs`
Fee structure per student: `fee_type` (`monthly_fixed`/`per_session`/`per_hour`), amount, currency. UNIQUE: `(workspace_id, student_id, fee_type)`.

#### `student_invoice_rows`
Individual invoice items: `invoice_type` (`monthly_fee`/`session_fee`/`manual_fine`), amount, due_date, status (`unpaid`/`proof_submitted`/`paid`/`waived`), proof_storage_path.

---

## 9. Row-Level Security (RLS) Policies

All 38 tables have RLS **enabled**. The policy model uses role-based patterns with helper functions:

### RLS Helper Functions

| Function | Purpose |
|----------|---------|
| `is_workspace_owner(_workspace_id)` | Current user is workspace owner |
| `is_workspace_member(_workspace_id)` | Current user is workspace member |
| `is_classroom_teacher(_user_id, _classroom_id)` | User is teacher of classroom |
| `is_user_tutor_of_classroom(p_user_id, p_classroom_id)` | User is tutor via classroom_tutors |
| `is_enrolled_in_classroom(_user_id, _classroom_id)` | User is actively enrolled |
| `is_classroom_in_workspace(p_classroom_id, p_workspace_id)` | Classroom belongs to workspace |
| `is_classroom_owned_by_owner(p_classroom_id, p_owner_id)` | Classroom in owner's workspace |
| `is_one_to_one_room_in_owner_workspace(p_room_id, p_owner_id)` | 1-on-1 room in owner's workspace |
| `is_document_shared_with_student(p_doc_id, p_student_id)` | Document shared via classroom/room |
| `is_storage_object_shared_with_student(p_file_path, p_student_id)` | Storage object shared |
| `is_storage_object_attached_to_assignment(p_file_path, p_student_id)` | Storage attachment check |
| `has_role(_user_id, _role)` | User has specific app role |
| `get_user_role(_user_id)` | Get user's role |

### Policy Summary by Table

| Table | Owner | Teacher/Tutor | Student |
|-------|-------|---------------|---------|
| `profiles` | View members + workspace students | View enrolled students + 1-on-1 students | CRUD own |
| `workspaces` | ALL | SELECT (as member) | — |
| `workspace_members` | CRUD | View own membership | — |
| `classrooms` | CRUD in workspace | CRUD own | SELECT enrolled |
| `enrollments` | CRUD | View + update | View own, leave |
| `assignments` | SELECT via workspace | CRUD own | SELECT published (enrollment/room) |
| `submissions` | SELECT via workspace | SELECT + UPDATE (grade) | INSERT + UPDATE + SELECT own |
| `quizzes` | SELECT via workspace | CRUD own | SELECT via enrollment/room |
| `quiz_attempts` | — | SELECT + UPDATE (grade) | INSERT + UPDATE + SELECT own |
| `documents` | SELECT in workspace | CRUD own | SELECT shared/attached |
| `sessions` | CRUD in workspace | CRUD own | SELECT (enrollment/1-on-1) |
| `tutor_contracts` | ALL in workspace | SELECT + UPDATE own | — |
| `tutor_payouts` | ALL in workspace | SELECT own | — |
| `student_invoice_rows` | ALL in workspace | — | SELECT own |

---

## 10. Database Functions & Triggers

### Business Logic Functions (45 total)

**Auth:**
- `handle_new_user()` — Trigger on `auth.users` INSERT; auto-creates `profiles` and `user_roles` rows
- `has_role(_user_id, _role)` → boolean
- `get_user_role(_user_id)` → app_role

**Classrooms:**
- `generate_join_code()` → text
- `get_classroom_by_join_code(code)` → TABLE(id, name, subject, teacher_name)

**AI Credits:**
- `get_credit_context(_user_id)` → TABLE(credits_limit, credits_used, remaining, source_type, source_id)
- `check_and_deduct_credits(_user_id, _task_type, _credit_cost, ...)` → jsonb — Atomically checks and deducts credits
- `can_make_ai_request(_user_id)` → jsonb
- `record_ai_interaction(...)` → uuid
- `get_or_create_ai_usage(_user_id, _month)` → user_ai_usage

**Credit & Storage Management:**
- `assign_credits_to_member(_workspace_id, _member_user_id, _credits, _caller)` → jsonb
- `update_assigned_credits(_workspace_id, _member_user_id, _new_limit, _caller)` → jsonb
- `assign_storage_to_member(_workspace_id, _member_user_id, _storage_limit_mb, _caller)` → jsonb
- `update_assigned_storage_limit(_workspace_id, _member_user_id, _new_limit_mb, _caller)` → jsonb
- `upsert_workspace_credit_pool(_workspace_id, _period, _credits_allocated)` → void
- `upsert_user_credit_allocation_subscription(_user_id, _period, _credits_limit)` → void

**Quizzes:**
- `start_quiz_attempt(_quiz_id, _student_id)` → SETOF quiz_attempts
- `can_attempt_quiz(_quiz_id, _student_id)` → jsonb
- `calculate_quiz_score(attempt_id)` → jsonb — Auto-grades MCQ and true/false questions

**Billing:**
- `billing_run_monthly_billing()` → void — Cron job function (see [Cron Jobs](#29-cron-jobs))

**Utility:**
- `handle_updated_at()` — Generic trigger to set `updated_at = now()`
- `rls_auto_enable()` — Event trigger to auto-enable RLS on new tables

### Triggers (20 total)

All tables with `updated_at` columns have BEFORE UPDATE triggers that auto-set `updated_at = now()`:
- `profiles`, `classrooms`, `documents`, `folders`, `assignments`, `submissions`, `quizzes`, `quiz_attempts`, `ai_generated_content`, `ai_feedback`, `user_ai_usage`, `one_to_one_rooms`, `workspaces`, `workspace_subscriptions`, `user_subscriptions`, `tutor_contracts`, `tutor_payouts`, `tutor_earning_rows`, `student_fee_configs`, `student_invoice_rows`

Additionally: `auth.users` has `on_auth_user_created` trigger calling `handle_new_user()`.

---

## 11. Storage Buckets & Policies

| Bucket | Public | Size Limit | Allowed MIME Types |
|--------|--------|------------|-------------------|
| `avatars` | Yes | none | any |
| `workspace-logos` | Yes | none | any |
| `documents` | No | 10 MB | any |
| `submissions` | No | none | any |
| `checked-papers` | No | 5 MB | any |
| `contracts` | No | none | any |
| `payment-proofs` | No | 10 MB | `image/png`, `image/jpeg`, `image/jpg`, `application/pdf` |

**Storage path convention:** Files are organized as `{user_id}/{filename}` or `{workspace_id}/{filename}`.

**Key storage policies:**
- Users CRUD their own files in `documents`, `submissions`, `avatars`
- Students can download shared documents (via `is_storage_object_shared_with_student`) and assignment attachments
- Teachers can upload/view checked papers
- Contract PDFs readable by workspace owner or the tutor
- Payment proofs: owners have full access; tutors read own payout proofs; students read own invoice proofs and upload into their workspace folder

---

## 12. Frontend Routing

### Public Routes

| Route | Page | Description |
|-------|------|-------------|
| `/` | Landing page | Marketing/home |
| `/auth` | Sign in / Forgot password | Zod-validated forms |
| `/auth/register` | Sign up | Email/password registration |
| `/auth/callback` | OAuth callback | Post-OAuth redirect handler |
| `/auth/choose-role` | Role selection | For OAuth users to pick role |
| `/reset-password` | Password reset | Token-based password reset |
| `/404` | Not found | Custom 404 page |

### Onboarding Routes

| Route | Description |
|-------|-------------|
| `/onboarding/business` | Owner workspace setup |
| `/onboarding/solo` | Solo tutor setup |
| `/onboarding/student` | Student profile setup |
| `/onboarding/change-password` | Forced password change for invited users |

### Billing Routes

| Route | Description |
|-------|-------------|
| `/select-plan` | Plan selection (Basic/Pro/Plus) |
| `/checkout` | Paddle checkout integration |

### Owner Dashboard (`/dashboard/owner/...`)

| Route | Description |
|-------|-------------|
| `/dashboard/owner` | Owner home dashboard |
| `/dashboard/owner/workspace` | Workspace settings |
| `/dashboard/owner/billing` | Subscription billing |
| `/dashboard/owner/finance` | Financial overview |
| `/dashboard/owner/payouts` | Tutor payouts management |
| `/dashboard/owner/tutors` | Tutor list |
| `/dashboard/owner/tutors/invite` | Invite new tutor |
| `/dashboard/owner/tutors/[id]` | Tutor profile |
| `/dashboard/owner/tutors/[id]/payout` | Tutor payout details |
| `/dashboard/owner/students` | Student list |
| `/dashboard/owner/students/invite` | Invite new student |
| `/dashboard/owner/students/[id]` | Student profile |
| `/dashboard/owner/students/[id]/billing` | Student billing |
| `/dashboard/owner/students/[id]/billing-setup` | Student fee configuration |
| `/dashboard/owner/classrooms` | Classroom list |
| `/dashboard/owner/classrooms/[id]` | Classroom details |
| `/dashboard/owner/rooms` | 1-on-1 rooms list |
| `/dashboard/owner/rooms/[roomId]` | Room details |
| `/dashboard/owner/assignments` | All assignments |
| `/dashboard/owner/quizzes` | All quizzes |
| `/dashboard/owner/sessions` | All sessions |
| `/dashboard/owner/documents` | Document center |
| `/dashboard/owner/contracts` | Contract list |
| `/dashboard/owner/contracts/new` | Create new contract |
| `/dashboard/owner/contracts/[id]` | Contract details |
| `/dashboard/owner/student-records` | Student academic records |
| `/dashboard/owner/student-records/[studentId]` | Individual student record |

### Teacher Dashboard (`/dashboard/teacher/...`)

| Route | Description |
|-------|-------------|
| `/dashboard/teacher` | Teacher home dashboard |
| `/dashboard/teacher/profile` | Teacher profile |
| `/dashboard/teacher/billing` | Subscription/billing info |
| `/dashboard/teacher/earnings` | Earnings overview |
| `/dashboard/teacher/contract` | View/sign contract |
| `/dashboard/teacher/calendar` | Calendar with Google sync |
| `/dashboard/teacher/classrooms` | Classroom list |
| `/dashboard/teacher/classrooms/[classroomId]` | Classroom details |
| `/dashboard/teacher/students` | Student list |
| `/dashboard/teacher/students/create` | Create/invite student |
| `/dashboard/teacher/student-records` | Student records |
| `/dashboard/teacher/student-records/[studentId]` | Individual record |
| `/dashboard/teacher/sessions` | Session list |
| `/dashboard/teacher/rooms` | 1-on-1 room list |
| `/dashboard/teacher/rooms/[roomId]` | Room details |
| `/dashboard/teacher/assignments` | Assignment list |
| `/dashboard/teacher/assignments/new` | Create assignment |
| `/dashboard/teacher/assignments/[assignmentId]/edit` | Edit assignment |
| `/dashboard/teacher/assignments/[assignmentId]/submissions` | View submissions |
| `/dashboard/teacher/quizzes` | Quiz list |
| `/dashboard/teacher/quizzes/create` | Create quiz |
| `/dashboard/teacher/quizzes/[quizId]/edit` | Edit quiz |
| `/dashboard/teacher/quizzes/[quizId]/results` | Quiz results |
| `/dashboard/teacher/documents` | Document center |
| `/dashboard/teacher/checker` | AI paper checker |
| `/dashboard/teacher/checker/presets` | Checker presets |
| `/dashboard/teacher/lesson-planner` | Lesson planner |
| `/dashboard/teacher/ai-studio` | AI Studio hub |
| `/dashboard/teacher/ai-studio/history` | AI generation history |
| `/dashboard/teacher/ai-studio/worksheet` | Worksheet generator |
| `/dashboard/teacher/ai-studio/paper` | Exam paper generator |
| `/dashboard/teacher/ai-studio/rubric` | Rubric generator |
| `/dashboard/teacher/ai-studio/smart-tutor` | Smart tutor (concept explainer) |
| `/dashboard/teacher/ai-studio/differentiate` | Differentiation tool |
| `/dashboard/teacher/ai-studio/output/[id]` | View generated output |

### Student Dashboard (`/dashboard/student/...`)

| Route | Description |
|-------|-------------|
| `/dashboard/student` | Student home dashboard |
| `/dashboard/student/billing` | Billing/invoices |
| `/dashboard/student/progress` | Academic progress |
| `/dashboard/student/library` | Study library |
| `/dashboard/student/course-materials` | Shared course materials |
| `/dashboard/student/documents` | Document center |
| `/dashboard/student/classrooms` | Enrolled classrooms |
| `/dashboard/student/classrooms/[classroomId]` | Classroom details |
| `/dashboard/student/assignments` | Assignment list |
| `/dashboard/student/sessions` | Session list |
| `/dashboard/student/rooms` | 1-on-1 rooms |
| `/dashboard/student/study` | Study hub |
| `/dashboard/student/practice-tests` | Practice tests |
| `/dashboard/student/quizzes` | Quiz list |
| `/dashboard/student/quizzes/[quizId]/take` | Start quiz |
| `/dashboard/student/quizzes/[quizId]/take/[attemptId]` | Take quiz (in progress) |
| `/dashboard/student/quizzes/[quizId]/results/[attemptId]` | Quiz results |

### Settings

| Route | Description |
|-------|-------------|
| `/dashboard/settings` | User settings (profile, password, email) |

---

## 13. API Routes

All API routes are under `pages/api/`. They use `getAuthUser(req, res)` for authentication (except webhooks which use `supabaseAdmin`).

### AI (`/api/ai/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ai/generate` | POST | General AI generation (all task types via OpenCode Go); deducts credits server-side |
| `/api/ai/check-paper` | POST | AI paper checking with rubric/instructions |
| `/api/ai/smart-tutor` | POST | Interactive AI concept explanation |
| `/api/ai/lesson-plan-from-syllabus` | POST | Generate structured lesson plan from syllabus text/PDF |
| `/api/ai/diagnostics` | GET | Owner-only gateway health check: key status, reachable model catalog, role→model mapping, unknown model ids; `?probe=1` also sends a tiny test prompt. No credits deducted |
| `/api/ai/test-models` | POST | Owner-only. Sends a real generation call to every configured model and reports which answer, with latency and rejected parameters. Costs 1 credit for the whole run (`model_test`), not one per model |

### Contracts (`/api/contracts/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/contracts/sign` | POST | Sign contract (tutor or owner) |
| `/api/contracts/download` | GET | Download contract PDF |
| `/api/contracts/export-pdf` | POST | Export contract body as PDF |
| `/api/contracts/export-doc` | POST | Export contract body as DOCX |
| `/api/contracts/request-change` | POST | Request contract change |
| `/api/contracts/update-body` | POST | Update contract body text |

### Credits (`/api/credits/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/credits/workspace` | GET | Get workspace credit pool |
| `/api/credits/assign` | POST | Assign credits to member |
| `/api/credits/member` | GET | Get member's credit allocation |
| `/api/credits/member/usage-history` | GET | Get member's AI usage history |

### Documents (`/api/documents/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/documents/extract-text` | POST | Extract text from uploaded file |
| `/api/documents/extract-file` | POST | Extract file content |
| `/api/documents/pdf-page-count` | POST | Get PDF page count |
| `/api/documents/split-pdf` | POST | Split PDF by page range |

### Google Calendar (`/api/google/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/google/connect` | GET | Start Google OAuth flow |
| `/api/google/callback` | GET | Handle OAuth callback |
| `/api/google/connection` | GET | Get connection status |
| `/api/google/disconnect` | POST | Disconnect Google Calendar |

### Owner (`/api/owner/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/owner/finance-summary` | GET | Financial summary for workspace |
| `/api/owner/payouts` | GET/POST | List/create payouts |
| `/api/owner/earning-rows` | GET | List earning rows |
| `/api/owner/students/[id]/invoices` | GET | Student invoice rows |
| `/api/owner/students/[id]/fee-configs` | GET/POST | Student fee configuration |

### Paddle Billing (`/api/paddle/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/paddle/checkout-url` | POST | Generate Paddle checkout URL |
| `/api/paddle/plan-prices` | GET | Fetch live plan prices from Paddle API |
| `/api/paddle/portal-session` | POST | Create Paddle customer portal session |

### Sessions (`/api/sessions/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sessions` | GET/POST | List/create sessions |
| `/api/sessions/[id]` | GET/PUT/DELETE | Session CRUD |
| `/api/sessions/[id]/complete` | POST | Mark session completed |
| `/api/sessions/[id]/financials` | GET | Session financial details |
| `/api/sessions/[id]/notes` | GET/POST | Session notes |
| `/api/sessions/financial-summary` | GET | Overall financial summary |

### Storage (`/api/storage/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/storage/workspace` | GET | Workspace storage usage |
| `/api/storage/assign` | POST | Assign storage to member |
| `/api/storage/member` | GET | Member storage allocation |
| `/api/storage/context` | GET | Full storage context |

### Student (`/api/student/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/student/invoices` | GET | Student's invoice rows |
| `/api/student/invoices/[id]/submit-proof` | POST | Submit payment proof |

### Teacher (`/api/teacher/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/teacher/payouts` | GET | Teacher's payouts |
| `/api/teacher/earning-rows` | GET | Teacher's earning rows |

### Tenant (`/api/tenant/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/tenant/create-user` | POST | Owner creates a user (tutor/student) with invite |
| `/api/tenant/invite-link` | POST | Generate invite link |
| `/api/tenant/student-workspace-access` | GET | Check student's workspace access |

### Webhooks (`/api/webhooks/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/webhooks/paddle` | POST | Paddle subscription lifecycle events |

### Workspace (`/api/workspace/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/workspace/currency` | GET/PUT | Workspace currency settings |

### Other

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/payment-proofs/url` | GET | Get signed URL for payment proof |

---

## 14. State Management & Data Fetching

### Architecture

```
┌─────────────────────────────────────────────┐
│                  React App                  │
│                                             │
│  ┌─────────────┐  ┌──────────────────────┐  │
│  │ AuthContext  │  │  QueryClientProvider │  │
│  │ (useAuth)   │  │  (TanStack Query v5) │  │
│  └─────────────┘  └──────────────────────┘  │
│         │                    │               │
│    user, role,          useQuery /           │
│    profile              useMutation          │
│         │                    │               │
│  ┌──────┴──────┐   ┌────────┴───────────┐   │
│  │  Pages /    │   │  Custom Hooks       │   │
│  │  Features   │   │  (useClassrooms,    │   │
│  │             │   │   useAssignments,   │   │
│  │             │   │   useQuizzes, ...)  │   │
│  └─────────────┘   └────────────────────┘   │
│                           │                  │
│              ┌────────────┴──────────┐       │
│              │  Supabase Client      │       │
│              │  (from(...).select/   │       │
│              │   insert/update)      │       │
│              └───────────────────────┘       │
└─────────────────────────────────────────────┘
```

### Patterns

1. **React Context** — `AuthProvider` (user identity, role, profile), `OnboardingDismissedProvider` (onboarding checklist state)
2. **TanStack React Query** — All data fetching uses `useQuery` with cache keys like `["classrooms", userId, role]`. Mutations use `useMutation` with `queryClient.invalidateQueries` for cache updates.
3. **Local useState** — Forms, UI toggles, and component-level state
4. **API calls** — Feature hooks either call Supabase client directly (for CRUD) or `fetch('/api/...')` for server-side operations (AI, billing, file processing)

---

## 15. Hooks Reference

| Hook | File | Description |
|------|------|-------------|
| `useAuth` | `src/hooks/useAuth.tsx` | Auth context (user, role, profile, sign in/out, etc.) |
| `useClassrooms` | `src/hooks/useClassrooms.ts` | CRUD classrooms (role-aware: teacher vs student queries) |
| `useAssignments` | `src/hooks/useAssignments.ts` | CRUD assignments with classroom/room embeds |
| `useSubmissions` | `src/hooks/useSubmissions.ts` | Assignment submissions CRUD |
| `useQuizzes` | `src/hooks/useQuizzes.ts` | CRUD quizzes |
| `useOneToOneRooms` | `src/hooks/useOneToOneRooms.ts` | 1-on-1 room management |
| `useLectureSessions` | `src/hooks/useLectureSessions.ts` | Session CRUD |
| `useSubscription` | `src/hooks/useSubscription.ts` | Workspace/user subscription status |
| `useHasActiveSubscription` | (in useSubscription) | Boolean subscription gate |
| `useStudentWorkspaceAccess` | (in useSubscription) | Student tenant access check |
| `useOwnerWorkspace` | `src/hooks/useOwnerWorkspace.ts` | Load owner's workspace, members, students, etc. |
| `useTutorWorkspace` | `src/hooks/useTutorWorkspace.ts` | Load tutor's workspace membership |
| `useWorkspaceCredits` | `src/hooks/useWorkspaceCredits.ts` | Workspace credit pool data |
| `useAIUsage` | `src/hooks/useAIUsage.ts` | User's AI usage stats |
| `useAIStudio` | `src/hooks/useAIStudio.ts` | AI Studio state and operations |
| `useAIChecker` | `src/hooks/useAIChecker.ts` | AI checker integration |
| `useAIPrep` | `src/hooks/useAIPrep.ts` | Student AI study tools |
| `useCheckerPresets` | `src/hooks/useCheckerPresets.ts` | Checker preset CRUD |
| `useStorage` | `src/hooks/useStorage.ts` | Storage quota and usage |
| `useDocCenterMini` | `src/hooks/useDocCenterMini.ts` | Document picker for AI tools |
| `useSourceDocuments` | `src/hooks/useSourceDocuments.ts` | Source documents for checker |
| `usePlannerCalendar` | `src/hooks/usePlannerCalendar.ts` | Planner events CRUD |
| `useLessonPlanner` | `src/hooks/useLessonPlanner.ts` | Lesson plan generation |
| `useSyllabusLessonPlanner` | `src/hooks/useSyllabusLessonPlanner.ts` | Syllabus-based lesson planning |
| `useTeacherDocuments` | `src/hooks/useTeacherDocuments.ts` | Teacher document management |
| `useTeacherDashboardStats` | `src/hooks/useTeacherDashboardStats.ts` | Dashboard statistics |
| `useTutorOnboardingStats` | `src/hooks/useTutorOnboardingStats.ts` | Onboarding progress |
| `useTutorContract` | `src/hooks/useTutorContract.ts` | Tutor contract operations |
| `useTeacherStudentRecords` | `src/hooks/useTeacherStudentRecords.ts` | Student academic records (teacher view) |
| `useOwnerStudentRecords` | `src/hooks/useOwnerStudentRecords.ts` | Student academic records (owner view) |
| `useClassroomStudents` | `src/hooks/useClassroomStudents.ts` | Students in a classroom |
| `useHasClassrooms` | `src/hooks/useHasClassrooms.ts` | Boolean: does user have classrooms? |
| `useWorkspaceCurrency` | `src/hooks/useWorkspaceCurrency.ts` | Workspace currency settings |
| `useRouter` | `src/hooks/useRouter.ts` | Next.js router wrapper |
| `use-mobile` | `src/hooks/use-mobile.tsx` | Responsive breakpoint hook |
| `use-toast` | `src/hooks/use-toast.ts` | Toast notification hook |

---

## 16. AI System

### Architecture

```
Browser                    Server (API Route)              External
┌──────────┐  fetch()    ┌──────────────────┐            ┌──────────────┐
│aiService │────────────►│/api/ai/generate  │───────────►│ OpenCode Go  │
│.ts       │◄────────────│                  │◄───────────│ (Zen) gateway│
└──────────┘  JSON       │  1. Auth check   │  OpenAI-   └──────────────┘
                         │  2. Credit check │  compatible
                         │  3. Model route  │  /chat/completions
                         │  4. Gateway call │
                         │  5. Deduct creds │
                         │  6. Log interact │
                         └──────────────────┘
```

### Provider: OpenCode Go (Zen)

All AI calls go through `src/server/ai/opencode.ts`, which points the OpenAI SDK
at the OpenCode Go gateway (`https://opencode.ai/zen/go/v1`) using a single
`OPENCODE_API_KEY` subscription key. Only the OpenAI-compatible Chat Completions
surface is used — the Responses API, Files API and `input_file` document parts
are OpenAI-specific and are not available, so uploaded documents are extracted to
text server-side before being inlined into the prompt.

### Model Routing

`resolveModel()` picks a model per task instead of hardcoding one. Each role is
overridable via env var (see §4) so the catalog can move without a code change.

| Role | Default model | Used for |
|------|---------------|----------|
| `general` | `kimi-k3` | Prose: content, papers, lesson plans, contracts, differentiation |
| `reasoning` | `deepseek-v4-pro` | Grading (`checker`), teacher evaluation, tutor matching |
| `structured` | `glm-5.2` | JSON output: rubrics, worksheets, quizzes, teacher tests |
| `longContext` | `minimax-m3` | Any prompt over 60,000 characters (512K context) |
| `fast` | `deepseek-v4-flash` | Short, low-stakes calls (study plans) |

Every default is the newest release in its family and was confirmed present and
responding via `POST /api/ai/test-models`. Re-run that check after changing any
`OPENCODE_MODEL_*` value.

Legacy OpenAI model ids (`gpt-4`, `gpt-4o`, `gpt-4o-mini`, `gpt-3.5-turbo`) sent
by older clients are remapped onto the equivalent OpenCode role rather than being
forwarded to the gateway.

### Parameter Fallback

The gateway aggregates several model families and they do not all accept the
same OpenAI parameters. `chatComplete()` retries down a ladder — full request,
then without `response_format`, then without `temperature` — and treats an empty
reply as a failure to retry rather than a successful empty answer. It also reads
`reasoning_content` when a reasoning model leaves `content` blank, and joins
array-shaped content parts. When every attempt is empty it throws naming the
model and pointing at `/models`, so a model id the plan does not expose is
identifiable without server logs. Use `/api/ai/diagnostics` to confirm.

### AI Task Types

```typescript
type AITaskType =
  | "content_generation"    // General content (worksheets, discussions, projects)
  | "checker"               // Grade submissions and papers
  | "lesson_planning"       // Generate lesson plans
  | "study_materials"       // Study notes, flashcards, summaries
  | "rubric_generation"     // Generate/edit rubrics
  | "paper_generation"      // Generate exam/test papers
  | "worksheet_generation"  // Generate structured worksheets (JSON)
  | "quiz_questions"        // Generate quiz questions (MCQ, T/F, short answer)
  | "differentiation"       // Differentiation strategies
  | "concept_explanation"   // Explain concepts (Smart Tutor)
  | "practice_questions"    // Practice question generation
  | "flashcards"            // Flashcard generation
  | "study_plan"            // Study plan creation
  | "contract_generation"   // Generate contract text
  | "contract_revision";    // Revise contract text
```

### AI Service Functions (`src/services/aiService.ts`)

| Function | Purpose |
|----------|---------|
| `checkAIUsageLimit(userId)` | Pre-check remaining credits via RPC |
| `generateAI(options)` | Core function: calls `/api/ai/generate` |
| `generateContent(prompt, userId, contentType)` | Worksheets, discussion questions, project ideas |
| `generateRubric(description, userId, options?, source?)` | Full rubric generation (JSON) |
| `generateRubricCriterion(...)` | Single rubric criterion regeneration |
| `generatePaper(params, userId)` | Exam/test paper generation (markdown) |
| `generateWorksheet(params, userId)` | Structured worksheet (JSON: title, instructions, questions) |
| `generateWorksheetQuestion(params, userId)` | Single worksheet question regeneration |
| `generateQuizQuestions(source, count, type, userId)` | Quiz question generation |
| `gradeSubmission(text, description, rubric, userId, points)` | AI grading with feedback |
| `suggestShortAnswerGrade(question, answer, points, userId)` | Grade short-answer quiz responses |
| `generateLessonPlanFromSyllabus(input, userId)` | Syllabus → structured lesson plan |
| `generateLessonPlan(subject, grade, topic, duration, objectives, userId)` | Standard lesson plan |
| `generateStudyMaterials(source, type, userId)` | Study materials (summary, flashcards, practice, concepts) |
| `explainConcept(concept, userId, context?)` | Concept explanation |
| `generateStudyPlan(assignments, time, userId)` | Study schedule |
| `suggestCalendarEventsFromPrompt(prompt, userId)` | Natural language → calendar events |

### Credit System Flow

1. **Client pre-check:** `checkAIUsageLimit` calls `get_credit_context` RPC to show remaining credits
2. **Server enforcement:** `/api/ai/generate` calls `check_and_deduct_credits` RPC atomically
3. **Credit deduction:** Function finds user's `user_credit_allocations` for current period, checks remaining, deducts
4. **Logging:** `record_ai_interaction` stores the interaction details

### Source Material Support

AI generation functions support:
- **Text input** — Pasted or extracted text (truncated to 18,000 chars)
- **PDF input** — Base64 PDF uploaded to the API route, extracted to text server-side with `pdf-parse` (DOCX via `mammoth`) and inlined into the prompt, capped at 180,000 chars
- Both patterns are supported for rubrics, papers, worksheets, and lesson plans

---

## 17. Billing & Subscriptions (Paddle)

### Plan Structure

Only **business (owner)** plans are used. Tutors and students get access through the owner's workspace.

| Tier | Monthly | Annual | Tutors | Students | AI Credits |
|------|---------|--------|--------|----------|------------|
| **Basic** | $79 | $790 | 3 | 50 | 300/month |
| **Pro** | $149 | $1,490 | 10 | 200 | 1,200/month |
| **Plus** | $249 | $2,490 | 20 | 500 | 3,000/month |

Basic plan includes a **14-day free trial**; Pro and Plus do not.

### Billing Flow

1. Owner selects plan on `/select-plan`
2. Frontend calls `/api/paddle/checkout-url` to get a Paddle checkout session
3. User completes checkout via Paddle overlay on `/checkout`
4. Paddle sends webhook to `/api/webhooks/paddle`
5. Webhook handler (using `supabaseAdmin`):
   - Verifies webhook signature (`PADDLE_WEBHOOK_SECRET`)
   - Processes subscription events (`subscription.created`, `subscription.updated`, `subscription.canceled`, etc.)
   - Updates `workspace_subscriptions` (status, price_id, period dates, storage limit)
   - Upserts `workspace_credit_pools` with credits from plan custom_data or env config
   - Resolves AI credits from Paddle product/price `custom_data` (fields: `ai_credits`, `doc_storage`)

### Subscription Access Logic (`useSubscription`)

- **Owners/teachers:** Check `workspace_subscriptions` for their workspace
- **Students:** Check `user_subscriptions` OR tenant workspace access via `/api/tenant/student-workspace-access`
- `useHasActiveSubscription` merges both paths based on role

---

## 18. Credits & Storage Quotas

### AI Credits

**Pool hierarchy:**
1. Paddle webhook allocates credits to `workspace_credit_pools` based on plan
2. Owner assigns credits from pool to members via `assign_credits_to_member` RPC
3. Each member gets a `user_credit_allocations` row (source: `workspace`)
4. Solo users with subscriptions get direct `user_credit_allocations` (source: `subscription`)

**Credit deduction:**
- `check_and_deduct_credits(_user_id, _task_type, _credit_cost, ...)` — Atomic RPC
- Each AI task type has a configurable weight via `AI_CREDIT_WEIGHT_*` env vars (default: 1)
- Workspace owner direct usage increments `credits_used_direct` on the pool

### Storage Quotas

- Workspace subscription defines `doc_storage_limit_mb`
- Owner assigns per-member storage via `user_storage_allocations`
- `src/server/storage-allocation.ts` handles quota checks
- `/api/storage/*` endpoints for management

---

## 19. Contracts & Financial Engine

### Contract Lifecycle

1. **Draft** — Owner creates contract with pay_type, rate, subjects, contract body
2. **Pending Signature** — Owner finalizes; tutor reviews
3. **Change Requested** — Tutor requests changes with a note
4. **Signed** — Both parties sign (tutor_signature_name + owner_signature_name)
5. **Active/Paused/Ended** — Operational status

### Pay Types

| Type | Description |
|------|-------------|
| `hourly` | Rate per hour; earnings calculated from session duration |
| `per_session` | Fixed rate per completed session |
| `fixed_monthly` | Monthly salary regardless of sessions |

### Financial Flow

1. **Sessions completed** → `tutor_earning_rows` created (gross_amount, platform_fee, net_amount)
2. **Monthly billing** → `billing_run_monthly_billing()` cron generates:
   - Fixed monthly earning rows for tutors
   - Monthly student invoice rows based on `student_fee_configs`
3. **Payouts** → Owner creates `tutor_payouts`, links earning rows, uploads proof
4. **Student invoices** → Students view `student_invoice_rows`, submit payment proofs

### Server Modules

- `src/server/billing/fee-engine.ts` — Fee calculation logic
- `src/server/billing/contract-engine.ts` — Contract processing
- `src/server/billing/financial-summary.ts` — Summary aggregation
- `src/server/billing/proof-storage.ts` — Payment proof storage helpers

---

## 20. Google Calendar Integration

### OAuth Flow

1. Teacher clicks "Connect Google Calendar"
2. Frontend redirects to `/api/google/connect` → Google OAuth consent screen
3. Google redirects to `/api/google/callback` with auth code
4. Server exchanges code for tokens, stores in `google_calendar_connections`

### Session Sync

When a session is created with `meeting_provider: 'google_meet'`:
1. Server creates a Google Calendar event via `src/server/google-calendar.ts`
2. Google auto-generates a Meet link
3. `external_event_id` and `meeting_url` stored on the session
4. Updates/deletions sync back to Google Calendar

### Planner Integration

Teachers can use AI to suggest calendar events from natural language:
- `suggestCalendarEventsFromPrompt` generates event objects
- Events can be added to `planner_events` or created as actual sessions

---

## 21. Document Management

### Storage Architecture

- Files stored in Supabase Storage (`documents` bucket)
- Path format: `{user_id}/{filename}`
- Metadata tracked in `documents` table (name, file_path, file_size, file_type)
- Organized with `folders` (self-referencing hierarchy)
- Tagged with `tags` / `document_tags`

### Sharing

- **To classrooms:** `document_classroom_shares` (teachers share, enrolled students can view)
- **To 1-on-1 rooms:** `document_one_to_one_room_shares` (tutors share with their students)
- **As assignment attachments:** `assignment_attachments` links documents to assignments

### Document Processing

- `/api/documents/extract-text` — Extract text from uploaded files (PDF via `pdf-parse`, DOCX via `mammoth`)
- `/api/documents/split-pdf` — Split PDF by page ranges using `pdf-lib`
- `/api/documents/pdf-page-count` — Get page count
- Doc Center Mini (`useDocCenterMini`) provides an in-app document picker for AI tools

---

## 22. Assignments & Submissions

### Assignment Flow

1. Teacher creates assignment (draft) — title, description, instructions, due date, points
2. Teacher attaches documents from Doc Center
3. Teacher publishes assignment → `status: 'published'`
4. Students see published assignments in their classroom/room
5. Students submit (file upload or text) → `submissions` row created
6. Teacher grades:
   - **Manual:** Sets grade and feedback directly
   - **AI-assisted:** Uses `gradeSubmission` from aiService for suggested grade + feedback
7. Teacher returns graded work → `status: 'returned'`

### Scope

Assignments belong to exactly one of:
- A `classroom` (group assignment)
- A `one_to_one_room` (private assignment)

Enforced by CHECK constraint.

---

## 23. Quizzes

### Quiz Flow

1. Teacher creates quiz (draft) — title, settings (time limit, max attempts, randomize, etc.)
2. Teacher adds questions (MCQ, true/false, short answer) — stored in `quiz_questions`
3. Teacher publishes quiz → `status: 'active'`
4. Student attempts quiz:
   - `can_attempt_quiz` RPC checks eligibility (max attempts, availability window)
   - `start_quiz_attempt` RPC creates attempt row
5. Student submits answers → `submitted_at` set
6. Auto-grading:
   - `calculate_quiz_score` RPC auto-grades MCQ and true/false
   - Short answer: teacher grades manually or uses `suggestShortAnswerGrade` AI
7. Results shown based on quiz settings (`show_correct_answers`, `show_results_immediately`)

### Question Types

| Type | Auto-gradable | Options | Correct Answer |
|------|---------------|---------|----------------|
| `multiple_choice` | Yes | `jsonb` array of `{text, is_correct}` | Derived from options |
| `true_false` | Yes | — | `"true"` or `"false"` |
| `short_answer` | No (AI-assisted) | — | Reference answer text |

---

## 24. Sessions & Scheduling

### Session Types

| Scope | Description |
|-------|-------------|
| `classroom` | Group session for a classroom |
| `one_to_one` | Private session with one student |

### Meeting Providers

| Provider | Description |
|----------|-------------|
| `google_meet` | Auto-creates Google Calendar event with Meet link |
| `manual` | Teacher manually provides meeting URL |

### Recurring Sessions

- `session_series` defines recurrence: frequency (`daily`/`weekly`), interval, count
- Individual `sessions` are created with `series_id` and `occurrence_index`

### Session Lifecycle

1. **Scheduled** — Created with time, classroom/room, meeting URL
2. **Completed** — Teacher marks complete → triggers earning calculation
3. **Cancelled** — Session cancelled

### Financial Link

Completed sessions generate `tutor_earning_rows` based on the tutor's contract (hourly/per_session).

---

## 25. UI Component Library

### shadcn/ui Primitives (`src/components/ui/`)

The project uses the shadcn/ui pattern: Radix UI primitives wrapped with Tailwind CSS and CVA (class-variance-authority). 40+ components including:

`accordion`, `alert`, `alert-dialog`, `aspect-ratio`, `avatar`, `badge`, `breadcrumb`, `button`, `calendar`, `card`, `carousel`, `chart`, `checkbox`, `collapsible`, `command`, `context-menu`, `dialog`, `drawer`, `dropdown-menu`, `form`, `hover-card`, `input`, `input-otp`, `label`, `menubar`, `navigation-menu`, `pagination`, `popover`, `progress`, `radio-group`, `resizable`, `scroll-area`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `slider`, `sonner`, `switch`, `table`, `tabs`, `textarea`, `toast`, `toggle`, `toggle-group`, `tooltip`

### Dashboard Layout (`src/components/dashboard/DashboardLayout.tsx`)

Role-aware sidebar navigation with three configs:
- **Owner (admin):** Workspace, finance, tutors, students, classrooms, rooms, sessions, assignments, quizzes, contracts, payouts, documents, student records, billing, settings
- **Teacher:** Dashboard, classrooms, students, rooms, sessions, assignments, quizzes, AI Studio, checker, lesson planner, calendar, documents, earnings, contract, billing, profile, student records, settings
- **Student:** Dashboard, classrooms, rooms, sessions, assignments, quizzes, study hub, practice tests, course materials, library, documents, progress, billing, settings

---

## 26. Design System & Brand

### Brand Colors

| Name | Hex | Usage |
|------|-----|-------|
| Ink Black | `#111827` | Primary text, dark backgrounds |
| Medium Slate Blue | `#8B5CF6` | Primary brand color (purple) |
| Slime Lime | `#A3E635` | Accent/premium (lime green) |
| Dust Grey | `#D4D4D8` | Borders, muted elements |
| Platinum | `#F4F4F5` | Light backgrounds |

### Gradients

| Name | Value |
|------|-------|
| `gradient-primary` | `#8B5CF6 → #6366F1` (purple) |
| `gradient-premium` | `#8B5CF6 → #A3E635` (purple to lime) |
| `gradient-dark` | `#111827 → #1F2937` (dark) |
| `gradient-hero` | Subtle purple/lime with 5% opacity |
| `gradient-progress` | `#8B5CF6 → #A3E635` (progress bars) |

### Typography

Primary font: **SF Pro Display** with system font fallbacks.

### Custom Animations

- `premium-pulse` — Lime green glow pulse (for premium features)
- `glow` — Lime green glow effect
- `shimmer` — Loading shimmer effect
- `accordion-down/up` — Radix accordion transitions

---

## 27. Form Handling & Validation

### Patterns

1. **react-hook-form + Zod** — Used via `src/components/ui/form.tsx` which provides `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage` components wired to RHF context.

2. **Controlled state + Zod safeParse** — Some forms (especially auth pages) use `useState` with manual `zod.safeParse` on submit.

### Validation Schemas (`src/lib/validation.ts`)

- `passwordSchema` — Basic password validation
- `strongPasswordSchema` — Strong password (min 8 chars, upper, lower, number, special)
- `resetPasswordSchema` — New password + confirm password match

### Auth Schemas (`pages/auth.tsx`)

- `signInSchema` — Email + password
- `forgotPasswordSchema` — Email only

---

## 28. PDF & Document Generation

### Libraries

| Library | Usage |
|---------|-------|
| `jspdf` + `jspdf-autotable` | PDF generation (reports, rubrics, lesson plans) |
| `pdf-lib` | PDF manipulation (split, merge) |
| `html2canvas` | HTML to canvas for PDF embedding |
| `docx` | Word document generation (contracts) |
| `mammoth` | DOCX to text extraction |
| `pdf-parse` | PDF text extraction |

### Generation Modules (`src/lib/`)

| Module | Purpose |
|--------|---------|
| `contractPdf.ts` | Contract PDF generation |
| `contractDoc.ts` | Contract DOCX export |
| `lessonPlanPdf.ts` | Lesson plan PDF export |
| `rubricPdf.ts` | Rubric PDF export |
| `pdfReports.ts` | General report PDFs |
| `pageRange.ts` | Page range parsing for PDF splitting |

---

## 29. Cron Jobs

| Schedule | Function | Description |
|----------|----------|-------------|
| `0 0 1 * *` (1st of month, midnight UTC) | `billing_run_monthly_billing()` | Generates monthly tutor earning rows (fixed_monthly contracts) and student invoice rows (monthly_fixed fees) |

Implemented via `pg_cron` extension.

---

## 30. Migration History

| # | Migration | Description |
|---|-----------|-------------|
| 1 | `20260308170000_basenew.sql` | Base schema: all core tables, functions, RLS, storage, triggers |
| 2 | `20260312100000_tutor_contracts_owner_signature.sql` | Add owner signature fields to contracts |
| 3 | `20260313100000_remove_classrooms_description.sql` | Drop classrooms.description; update join code function |
| 4 | `20260313110000_workspace_students_and_one_to_one_rooms.sql` | Create workspace_students, one_to_one_rooms; backfill data |
| 5 | `20260313120000_one_to_one_rooms_assignments_quizzes_docs.sql` | Add one_to_one_room_id to assignments/quizzes; document room shares; RLS updates |
| 6 | `20260315120000_billing_payout_schema.sql` | Billing tables: payouts, earnings, fee configs, invoice rows; contract billing fields |
| 7 | `20260315130000_tutor_view_student_profile_1v1.sql` | Tutor can view 1-on-1 student profiles |
| 8 | `20260315140000_billing_monthly_cron.sql` | Monthly billing cron function + pg_cron schedule |
| 9 | `20260315150000_owner_view_student_profile_workspace_students.sql` | Owner can view workspace student profiles |
| 10 | `20260315160000_tutor_contracts_allow_fixed_monthly_pay_type.sql` | Add fixed_monthly to pay_type CHECK |
| 11 | `20260316100000_ensure_payment_proofs_bucket.sql` | Idempotent payment-proofs bucket creation |
| 12 | `20260316110000_fix_owner_assignments_quizzes_rls.sql` | Fix owner RLS policies for assignments/quizzes |

---

## 31. Testing

- **Framework:** Vitest 3.2.x with jsdom environment
- **Libraries:** Testing Library (React + jest-dom)
- **Commands:** `npm test` (single run), `npm run test:watch` (watch mode)
- **Test location:** `src/test/`
- **Status:** Minimal test coverage (example test exists)

---

## 32. Key Architectural Decisions

### 1. Next.js Pages Router (not App Router)
The app uses the Pages Router for file-based routing. All pages are in `pages/`, API routes in `pages/api/`.

### 2. No Middleware
Auth and API protection are handled via `withAuth` HOC and `getAuthUser` helper, not Next.js middleware.

### 3. No Global State Library
Server state is managed entirely by TanStack React Query. Auth state is in React Context. There is no Redux, Zustand, or similar.

### 4. Supabase as Backend
Supabase handles auth, database, storage, and real-time. There is no separate backend server. Business logic is split between:
- Database functions/RPC (atomic operations like credit deduction)
- Next.js API routes (orchestration, external API calls)
- Client-side hooks (data fetching, caching)

### 5. Single AI Provider: OpenCode Go
All AI runs through the OpenCode Go (Zen) gateway under one subscription key, which fronts MiniMax, Kimi, GLM, DeepSeek, Qwen and MiMo models. Model selection is centralised in `src/server/ai/opencode.ts`; no route hardcodes a model. The `provider` field in `ai_interactions` records `opencode`.

### 6. Paddle for Billing
Subscription management is handled entirely through Paddle (checkout, webhooks, customer portal). The app does not store payment methods or process payments directly.

### 7. RLS as Primary Access Control
All database access control is enforced via PostgreSQL Row-Level Security policies. The browser client uses the anon key; RLS policies ensure users can only access their own data. The service role client (`supabaseAdmin`) bypasses RLS and is used only in trusted server contexts (webhooks, privileged operations).

### 8. Multi-tenant via Workspaces
Tenant isolation is achieved through `workspaces` and associated tables (`workspace_members`, `workspace_students`). RLS policies reference workspace ownership and membership.

### 9. Credit System for AI Usage
AI features are gated by a credit system. Credits are allocated at the workspace level (from subscription) and distributed to members by the owner. Each AI task type has a configurable credit weight.

### 10. Dual Scope: Classrooms & 1-on-1 Rooms
Assignments, quizzes, sessions, and document shares can belong to either a classroom (group) or a one-to-one room (private). This is enforced by CHECK constraints and dual-column patterns.

---

## Entity Relationship Diagram (Text)

```
auth.users
 ├── profiles (1:1)
 ├── user_roles (1:1)
 ├── workspaces (1:N via owner_id)
 │    ├── workspace_members (N:M users)
 │    ├── workspace_students (N:M students)
 │    ├── workspace_subscriptions (1:1)
 │    ├── workspace_credit_pools (1:N by period)
 │    ├── user_storage_allocations (1:N)
 │    ├── classrooms (1:N)
 │    │    ├── classroom_tutors (N:M)
 │    │    ├── enrollments (N:M students)
 │    │    ├── assignments (1:N)
 │    │    │    ├── assignment_attachments (N:M → documents)
 │    │    │    └── submissions (1:N)
 │    │    │         └── ai_feedback (1:N)
 │    │    ├── quizzes (1:N)
 │    │    │    ├── quiz_questions (1:N)
 │    │    │    └── quiz_attempts (1:N)
 │    │    ├── sessions (1:N)
 │    │    ├── session_series (1:N)
 │    │    ├── document_classroom_shares (N:M → documents)
 │    │    └── checked_papers (1:N)
 │    ├── one_to_one_rooms (1:N)
 │    │    ├── assignments (1:N)
 │    │    ├── quizzes (1:N)
 │    │    └── document_one_to_one_room_shares (N:M → documents)
 │    ├── tutor_student_assignments (N:M tutor↔student)
 │    ├── tutor_contracts (1:N)
 │    ├── tutor_payouts (1:N)
 │    ├── tutor_earning_rows (1:N)
 │    ├── student_fee_configs (1:N)
 │    └── student_invoice_rows (1:N)
 ├── user_subscriptions (1:1)
 ├── user_credit_allocations (1:N by period)
 ├── google_calendar_connections (1:1)
 ├── documents (1:N)
 │    ├── folders (1:N, self-referencing)
 │    ├── document_tags (N:M → tags)
 │    └── tags (1:N)
 ├── ai_interactions (1:N)
 ├── ai_generated_content (1:N)
 ├── user_ai_usage (1:N by month)
 ├── planner_events (1:N)
 ├── source_documents (1:N)
 ├── checker_presets (1:N)
 └── checked_papers (1:N)
```

---

## Data Flow Diagrams

### Authentication Flow

```
User → /auth (sign in) → Supabase Auth → onAuthStateChange
  → Load user_roles.role → Load profiles → AuthProvider
  → withAuth HOC checks: role, password_changed_at, onboarding, subscription
  → Redirect to appropriate dashboard or gate
```

### AI Generation Flow

```
User → AI Studio form → aiService.generate*()
  → checkAIUsageLimit() [RPC: get_credit_context]
  → fetch(/api/ai/generate) [POST with prompt, taskType, userId]
  → Server: getAuthUser() → check_and_deduct_credits [RPC]
  → resolveModel(taskType, promptSize) → OpenCode Go /chat/completions
  → record_ai_interaction [RPC]
  → Response: content, tokens, cost, credits_deducted
```

### Billing Flow

```
Owner → /select-plan → /api/paddle/checkout-url → Paddle overlay
  → Payment → Paddle webhook → /api/webhooks/paddle
  → supabaseAdmin: update workspace_subscriptions
  → upsert workspace_credit_pools
  → UI: useSubscription refreshes → access granted
```

### Session Completion Flow

```
Teacher marks session complete → /api/sessions/[id]/complete
  → Update session status → Calculate earnings from contract
  → Create tutor_earning_rows (gross, fee, net)
  → Create student_invoice_rows (if per_session fee config)
```
