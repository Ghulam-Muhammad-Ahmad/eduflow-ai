import { useMemo, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useStudentTutors } from "@/hooks/useStudentTutors";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Search, UserRound, Eye } from "lucide-react";

export default function StudentTutors() {
  const { tutors, isLoading } = useStudentTutors();
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tutors;
    return tutors.filter(
      (t) =>
        t.display_name.toLowerCase().includes(q) ||
        t.subjects.some((s) => s.toLowerCase().includes(q)) ||
        t.classrooms.some((c) => c.name.toLowerCase().includes(q))
    );
  }, [tutors, searchQuery]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold lg:text-3xl">My Tutors</h1>
          <p className="mt-1 text-muted-foreground">
            The tutors who teach your classes and 1v1 sessions.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" className="text-muted-foreground" />
          </div>
        ) : tutors.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <UserRound className="mb-4 h-12 w-12 text-muted-foreground" />
              <h2 className="text-lg font-semibold">No tutors yet</h2>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                Once you are added to a class or a 1v1 room, your tutors will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="relative max-w-sm">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                placeholder="Search by name, subject, or class..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                aria-label="Search tutors"
              />
            </div>

            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No tutors match &quot;{searchQuery}&quot;.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((tutor) => (
                  <Card key={tutor.user_id} className="transition-shadow hover:shadow-lg">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12 shrink-0">
                          <AvatarImage src={tutor.avatar_url ?? undefined} alt="" />
                          <AvatarFallback className="bg-primary/10 font-semibold text-primary">
                            {tutor.display_name[0]?.toUpperCase() ?? "T"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <CardTitle className="truncate text-lg">{tutor.display_name}</CardTitle>
                          <CardDescription className="truncate">
                            {tutor.subjects.length > 0
                              ? tutor.subjects.join(", ")
                              : "Tutor"}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {tutor.bio && (
                        <p className="line-clamp-3 text-sm text-muted-foreground">{tutor.bio}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {tutor.classrooms.map((c) => (
                          <Badge key={c.id} variant="outline" className="text-xs">
                            {c.name}
                          </Badge>
                        ))}
                        {tutor.one_to_one_rooms.map((r) => (
                          <Badge key={r.id} variant="secondary" className="text-xs">
                            {r.name ?? "1v1 room"}
                          </Badge>
                        ))}
                      </div>
                      <Button variant="outline" className="w-full gap-2" asChild>
                        <Link href={`/dashboard/student/tutors/${tutor.user_id}`}>
                          <Eye className="h-4 w-4" />
                          View profile
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
