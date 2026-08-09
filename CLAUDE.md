# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Start Next.js dev server

# Build & lint
npm run build        # Production build (ESLint skipped via next.config.js)
npm run lint         # Run ESLint

# Tests
npm run test         # Run all tests once (Vitest)
npm run test:watch   # Run tests in watch mode
```

## Architecture Overview

**Eduflow AI** is a multi-tenant SaaS for tutoring centers with three user roles: **Owner** (admin), **Teacher**, and **Student**. Every feature and route is scoped to one of these roles.

### Auth & Role Protection

- `src/lib/withAuth.tsx` — HOC wrapping every protected page. Enforces authentication, role validation, onboarding completion, password-change-on-first-login, and active subscription. Every dashboard page uses this.
- `src/hooks/useAuth.tsx` — React context providing the auth user and profile. The profile row (from `profiles` table) carries role, onboarding status, and subscription state.
- Supabase clients live in `src/integrations/supabase/`:
  - `client.ts` — browser client (SSR-cookie-aware)
  - `server.ts` — API route client + `getAuthUser()` helper used at the top of every API handler
  - `admin.ts` — admin client for privileged server operations

### Directory Layout

```
pages/              Next.js pages + API routes (49 endpoints)
src/
  components/       Shared UI — ui/ has Radix-based primitives; domain folders (ai/, teacher/, etc.)
  features/         Role-scoped feature components: dashboard/owner/, dashboard/teacher/, dashboard/student/
  hooks/            Custom hooks — data fetching hooks (useAssignments, useClassrooms, etc.) plus useAuth
  integrations/     Supabase client setup and generated types (types.ts — 66KB, do not hand-edit)
  lib/              Utilities: withAuth, AI credit logic, PDF/DOCX generation, billing helpers
  server/           Server-only utilities: ai/ (OpenCode provider + model routing), billing, Google Calendar, storage-allocation, lecture sessions
  services/         aiService.ts — client-side AI helpers that call /api/ai/* (chat, generation, checking)
  types/            AppRole, AccountType enums and shared TS types
supabase/
  migrations/       SQL migrations; basenew.sql is the canonical base schema
```

### Data & State Patterns

- **Server state:** React Query (`@tanstack/react-query`). Each domain has a dedicated hook (e.g., `useAssignments`, `useQuizzes`) that wraps Supabase queries and React Query calls.
- **Forms:** `react-hook-form` + Zod validation schemas.
- **Client state:** local `useState`/`useReducer` inside feature components — no global store.

### API Route Conventions

All API routes follow this pattern:
1. Call `getAuthUser()` from `src/integrations/supabase/server.ts` to authenticate.
2. Use the server Supabase client for DB operations (RLS is enforced).
3. Return JSON with appropriate status codes.

Key API groups: `pages/api/ai/` (OpenCode calls + credit deduction), `pages/api/billing/`, `pages/api/contracts/`, `pages/api/credits/`, `pages/api/owner/`, `pages/api/teacher/`, `pages/api/student/`.

### AI Credits

- `src/lib/ai-credits.ts` — reads a user's credit balance.
- `src/lib/ai-credits-deduct.ts` — deducts credits after AI operations.
- Every `/api/ai/` route checks and deducts credits; never call the AI gateway without this guard.

### AI Provider (OpenCode Go)

- All AI goes through `src/server/ai/opencode.ts` — never instantiate a provider client in a route.
- The gateway is OpenAI-compatible **Chat Completions only** (`https://opencode.ai/zen/go/v1`), authenticated with `OPENCODE_API_KEY`. The OpenAI Responses API, Files API and `input_file` parts are not available.
- Use `chatComplete()` for generation and `parseJsonResponse()` for JSON replies. Do not hardcode model ids in routes — pass `taskType` and let `resolveModel()` choose; defaults are overridable via `OPENCODE_MODEL_*` env vars.
- Uploaded PDFs/DOCX must be turned into text with `extractDocumentText()` before being put in a prompt.
- `chatComplete()` retries transient upstream failures (429/5xx) with backoff, then retries without `response_format`, then without `temperature`, and treats an empty reply as a failure — never return the gateway's empty string to a caller as success.
- All model roles default to `deepseek-v4-flash`. Override one role with `OPENCODE_MODEL_<ROLE>`, or all of them with `OPENCODE_MODEL`.
- `GET /api/ai/diagnostics` (owner-only) lists reachable models and flags configured ids the plan does not expose; add `?probe=1` for a live test call.
- `POST /api/ai/test-models` (owner-only, 1 credit per run) calls every configured model for real. Surfaced as the "AI connection" card on the owner Workspace page (`OwnerAIHealthCard`).

### Styling

- Tailwind CSS with custom brand tokens: `ink-black`, `medium-slate-blue`, `slime-lime`, `dust-grey`, `platinum`.
- Semantic CSS variables for theming (see `tailwind.config.ts`).
- Dark mode via `.dark` class strategy.
- `@/*` maps to `src/*` (TypeScript path alias).

### Supabase / Database

- Row-Level Security is the primary multi-tenant isolation mechanism — rely on it, don't bypass.
- Generated types in `src/integrations/supabase/types.ts` are auto-generated; regenerate with `supabase gen types typescript` when schema changes.
- Migrations are in `supabase/migrations/`; the base schema is `20260308170000_basenew.sql`.

### Secrets

- `next.config.js` `env` entries are inlined into the client bundle — only `NEXT_PUBLIC_*` values belong there. Server secrets are read from `process.env` inside API routes.

### Document Generation

`src/lib/contractDoc.ts` / `contractPdf.ts` / `pdfReports.ts` handle DOCX and PDF generation using `docx`, `jspdf`, `html2canvas`, and `pdf-lib`. Server-side PDF parsing uses `pdf-parse` and `mammoth` (for DOCX).
