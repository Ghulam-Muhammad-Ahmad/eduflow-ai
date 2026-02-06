---
name: ux-ui-designer
description: Applies UX/UI design principles when designing interfaces, reviewing UI, or improving usability. Use when designing screens, creating layouts, choosing components, improving accessibility, or when the user asks about UX, UI, usability, or visual design.
---

# UX/UI Designer

## When to Apply

- Designing new screens or interfaces
- Choosing or arranging UI components (buttons, forms, modals, navigation)
- Improving usability or user flows
- Accessibility (WCAG, contrast, focus, semantics)
- Visual hierarchy, typography, spacing, or color
- User asks about design, UX, or UI best practices

---

## UX Principles

### User-Centric Decisions

- **Reduce cognitive load**: Fewer choices per screen; group related actions.
- **Progressive disclosure**: Show essentials first; reveal complexity on demand (expand, modal, accordion).
- **Clear feedback**: Loading states, success/error toasts, disabled states during async actions.
- **Forgiveness**: Confirm destructive actions (AlertDialog); support undo where feasible.

### Information Architecture

- **Logical grouping**: Related content and actions belong together.
- **Consistent patterns**: Same task → same place (e.g. “Create” always in header or floating action).
- **Breadcrumbs**: Use when navigation depth > 2 levels; keep paths short.

### Interaction & Flow

- **Primary action prominent**: One main CTA per section; secondary actions visually de-emphasized.
- **Form flow**: Logical order; inline validation; clear error messages near fields.
- **Empty states**: Don’t leave blanks; provide helpful copy and next-step actions (e.g. “No items yet. Add your first.”).

---

## UI Principles

### Visual Hierarchy

- **Size and weight**: Headings > body; primary content > secondary.
- **Contrast**: Important elements stand out; decorative elements recede.
- **Whitespace**: Use spacing to group related items and separate sections; avoid cramming.

### Typography

- **Limited scale**: 2–4 text sizes; use semantic headings (h1–h4).
- **Readable line length**: ~45–75 characters for body; cap max-width on text blocks.
- **Line height**: ~1.5 for body text; slightly tighter for large headings.

### Color

- **Purpose, not decoration**: Color for status, emphasis, and affordance; not random.
- **Contrast**: Meet WCAG AA (4.5:1 for body text; 3:1 for large text).
- **Consistency**: Use design-system tokens (e.g. `primary`, `destructive`, `muted`); avoid ad-hoc hex values.

### Spacing

- **Systematic scale**: Use a spacing scale (e.g. 4, 8, 16, 24, 32) for padding and margins.
- **Aligned spacing**: Match related elements; avoid one-off gaps.
- **Touch targets**: Minimum ~44×44px for interactive elements on mobile.

---

## Component Selection

| Need | Prefer |
|------|--------|
| Single-choice option | RadioGroup, Select |
| Multi-choice | Checkbox group |
| Short text | Input |
| Long text | Textarea |
| Toggle on/off | Switch |
| Destructive / irreversible | AlertDialog with explicit confirm |
| Non-blocking feedback | Toast (sonner) |
| Blocking feedback | Alert, Dialog |
| Tabbed content | Tabs |
| Collapsible sections | Accordion, Collapsible |
| Navigation hierarchy | Breadcrumb, NavigationMenu |

Use existing `src/components/ui/` primitives; avoid reinventing patterns that already exist.

---

## Accessibility Checklist

- [ ] Semantic HTML (button, link, heading, list, form labels)
- [ ] Focus visible (keyboard navigation)
- [ ] Sufficient color contrast
- [ ] Meaningful alt text for images
- [ ] Form labels associated with inputs
- [ ] Error messages linked to invalid fields
- [ ] Skip links or logical tab order for long pages

---

## Feedback Format

When reviewing or suggesting UI changes, structure feedback as:

- **UX**: Flow, clarity, feedback, forgiveness
- **UI**: Hierarchy, spacing, typography, color, consistency
- **A11y**: Contrast, focus, semantics, labels

Keep suggestions specific and actionable.

---

## Additional Resources

- For detailed design tokens and component usage, see [reference.md](reference.md)
