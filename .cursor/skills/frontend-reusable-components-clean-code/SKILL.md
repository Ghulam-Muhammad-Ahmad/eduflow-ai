---
name: frontend-reusable-components-clean-code
description: Guides frontend development with reusable components and clean code. Use when building UI, creating or refactoring React/TSX components, reviewing frontend code, or when the user asks about component reuse, clean code, or UI best practices.
---

# Frontend Reusable Components & Clean Code

## When to Apply

- Building or refactoring UI components
- Adding new pages or features that use existing UI
- Code review of frontend/React code
- User asks about reusability, clean code, or component structure

---

## Reusable Component Principles

### 1. Prefer existing primitives

- Use `src/components/ui/` primitives (Button, Card, Dialog, Input, Select, etc.) instead of custom HTML + Tailwind for the same behavior.
- Compose with `className` override via `cn()` when styling needs to change: `className={cn("existing", customClass)}`.
- Do not duplicate UI patterns that already exist in `src/components/ui/`.

### 2. Single responsibility

- One component = one clear purpose (e.g. a list item, a form field wrapper, a section header).
- If a component does layout + data fetching + complex business logic, split into: presentational component + hook (or parent) that handles data and logic.

### 3. Composition over configuration

- Prefer children and optional slots over long prop lists and “variant” explosions.
- Use small, composable pieces (e.g. Card + CardHeader + CardContent) rather than one mega-component with many props.

### 4. Props: minimal and typed

- Export a single props interface; use `React.ComponentPropsWithoutRef<'element'>` or `ComponentProps<typeof Button>` when extending primitives.
- Optional props with sensible defaults; avoid required props for purely stylistic choices when a default is obvious.
- Use `children` for content; use explicit props for behavior and structure (e.g. `title`, `description`, `actions`).

### 5. File and folder layout

- One main component per file; name file after the component (PascalCase).
- Shared primitives: `src/components/ui/`.
- Feature-specific components: `src/components/<feature>/` (e.g. `ai/`, `dashboard/`, `student/`).
- Shared hooks: `src/hooks/`; keep hooks focused (one concern per hook when possible).

---

## Clean Code Rules

### Naming

- Components and files: PascalCase.
- Hooks: `use` + camelCase.
- Props interfaces: `ComponentNameProps` or omit if the component is the only export.
- Booleans: `isLoading`, `hasError`, `canSubmit`; avoid negatives in names when possible.

### Styling

- Use the project’s `cn()` helper for conditional/merged classes (from `@/lib/utils`).
- Prefer Tailwind utility classes; avoid one-off inline styles unless dynamic (e.g. width from data).
- Keep variant logic in the component or in `cva()` (like `buttonVariants`); don’t scatter magic strings.

### Logic and state

- Keep components mostly presentational; move data fetching, submission, and complex state into hooks or parent components.
- Prefer explicit state; avoid redundant state (derive values when possible).
- Handle loading and error states in the UI when the component or its parent owns the data.

### Size and structure

- Prefer smaller, readable components; if a file grows beyond ~150–200 lines, consider splitting (subcomponents, hooks, or separate files).
- Extract repeated JSX into a small component or a mapped fragment; extract repeated logic into a hook.

### Imports and exports

- Use path alias `@/` for imports (e.g. `@/components/ui/button`, `@/lib/utils`, `@/hooks/...`).
- Default export for the main component; named exports for types and small utilities if needed.

---

## Quick Checklist

Before adding a new component:

- [ ] No existing `src/components/ui/` or feature component that already does this?
- [ ] Single responsibility and clear naming?
- [ ] Uses `cn()` for class merging and existing UI primitives where applicable?
- [ ] Props typed and minimal; composition via children/slots where it fits?
- [ ] Data/async logic in a hook or parent, not mixed into a presentational component?

When refactoring:

- [ ] Duplicate logic or JSX extracted into shared component or hook?
- [ ] No unnecessary prop drilling (consider context or composition if many levels)?
- [ ] File size and responsibilities kept in check?

---

## Additional Resources

- For before/after examples, see [examples.md](examples.md).
