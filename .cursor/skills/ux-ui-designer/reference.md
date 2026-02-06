# UX/UI Designer Reference

## Design Tokens (eduflow-ai)

The project uses CSS variables for theming. Prefer these over raw colors:

| Token | Purpose |
|-------|---------|
| `primary` | Main CTA, links, emphasis |
| `primary-foreground` | Text on primary backgrounds |
| `secondary` | Secondary actions, subtle backgrounds |
| `muted` / `muted-foreground` | De-emphasized content, placeholders |
| `destructive` | Delete, remove, error actions |
| `accent` | Hover highlights, selections |
| `background` / `foreground` | Page base |

Tailwind: `bg-primary`, `text-muted-foreground`, `border-border`, etc.

---

## Spacing Scale (Tailwind)

| Class | Pixels | Use |
|-------|--------|-----|
| `p-1` / `m-1` | 4 | Tight inline spacing |
| `p-2` / `m-2` | 8 | Between small elements |
| `p-4` / `m-4` | 16 | Between components |
| `p-6` / `m-6` | 24 | Section padding |
| `p-8` / `m-8` | 32 | Page/section margins |
| `gap-4`, `gap-6` | 16, 24 | Flex/Grid gaps |

---

## Typography Scale

- `text-xs` – Captions, labels
- `text-sm` – Body secondary, form labels
- `text-base` – Body primary
- `text-lg` – Subheadings
- `text-xl` / `text-2xl` – Section headings
- `text-3xl` / `text-4xl` – Page titles

---

## Common Patterns

### Form Layout
- Stack fields vertically with consistent spacing (`space-y-4`)
- Group related fields; use separators or Card for distinct sections
- Place primary submit button clearly; secondary actions (Cancel) less prominent

### Empty States
- Icon + short heading + description
- Single clear CTA (e.g. "Add your first item")
- Use `muted-foreground` for description text

### Loading States
- Use Skeleton for content placeholders
- Use Button `disabled` + loading text for form submissions
- Use Toast for background operation feedback

### Error Handling
- Inline errors near fields (Form + FormMessage)
- Toast for submission failures
- Alert or AlertDialog for critical errors requiring attention
