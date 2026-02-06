# Examples: Reusable Components & Clean Code

## Prefer primitives

**Avoid:** Custom button with inline Tailwind duplicating Button behavior.

```tsx
<button className="rounded-lg bg-primary px-4 py-2 text-white hover:opacity-90">
  Submit
</button>
```

**Prefer:** Use the shared Button and override only when needed.

```tsx
import { Button } from "@/components/ui/button";

<Button>Submit</Button>
<Button variant="outline" className="w-full sm:w-auto">Cancel</Button>
```

---

## Composition over one big component

**Avoid:** One component with many optional props for layout and content.

```tsx
<Card variant="withHeader" title="Settings" subtitle="Manage preferences" actions={<Button>Save</Button>} />
```

**Prefer:** Compose with existing Card pieces.

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

<Card>
  <CardHeader>
    <CardTitle>Settings</CardTitle>
    <CardDescription>Manage preferences</CardDescription>
  </CardHeader>
  <CardContent>{/* form */}</CardContent>
  <CardFooter><Button>Save</Button></CardFooter>
</Card>
```

---

## Single responsibility: split UI and data

**Avoid:** Component that fetches and renders in one place.

```tsx
function StudentList() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/students").then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, []);
  if (loading) return <Spinner />;
  return <ul>{data.map(s => <li key={s.id}>{s.name}</li>)}</ul>;
}
```

**Prefer:** Hook for data; presentational component for UI.

```tsx
// hooks/useStudents.ts
export function useStudents() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { /* fetch */ }, []);
  return { students: data, isLoading: loading };
}

// components/StudentList.tsx
interface StudentListProps {
  students: { id: string; name: string }[];
  isLoading?: boolean;
}
function StudentList({ students, isLoading }: StudentListProps) {
  if (isLoading) return <Skeleton className="h-8 w-full" />;
  return <ul>{students.map(s => <li key={s.id}>{s.name}</li>)}</ul>;
}

// Page
const { students, isLoading } = useStudents();
return <StudentList students={students} isLoading={isLoading} />;
```

---

## Typed props and cn()

**Good:** Minimal, typed props and class merging.

```tsx
import { cn } from "@/lib/utils";

interface PageSectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function PageSection({ title, children, className }: PageSectionProps) {
  return (
    <section className={cn("space-y-4", className)}>
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
```

---

## Extending a primitive’s props

**Good:** Reuse Button props and add a few more.

```tsx
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface IconButtonProps extends ButtonProps {
  icon: React.ReactNode;
}

export function IconButton({ icon, children, className, ...props }: IconButtonProps) {
  return (
    <Button className={cn("gap-2", className)} {...props}>
      {icon}
      {children}
    </Button>
  );
}
```
