import { useRouter } from "next/router";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useStudentTutors } from "@/hooks/useStudentTutors";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { ArrowLeft, BookOpen, UserRound } from "lucide-react";

export default function StudentTutorProfile() {
  const router = useRouter();
  const tutorId = typeof router.query.tutorId === "string" ? router.query.tutorId : null;
  const { tutors, isLoading } = useStudentTutors();
  const tutor = tutors.find((t) => t.user_id === tutorId);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-16">
          <Spinner size="lg" className="text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!tutor) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-16">
          <UserRound className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="mb-4 text-muted-foreground">
            This tutor profile is not available to you.
          </p>
          <Button variant="outline" asChild>
            <Link href="/dashboard/student/tutors">Back to My Tutors</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/student/tutors" aria-label="Back to My Tutors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex min-w-0 items-center gap-4">
            <Avatar className="h-16 w-16 shrink-0">
              <AvatarImage src={tutor.avatar_url ?? undefined} alt="" />
              <AvatarFallback className="bg-primary/10 text-xl font-semibold text-primary">
                {tutor.display_name[0]?.toUpperCase() ?? "T"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold lg:text-3xl">{tutor.display_name}</h1>
              <p className="mt-1 text-muted-foreground">
                {tutor.subjects.length > 0 ? tutor.subjects.join(" · ") : "Tutor"}
              </p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">About</CardTitle>
          </CardHeader>
          <CardContent>
            {tutor.bio ? (
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{tutor.bio}</p>
            ) : (
              <p className="text-sm italic text-muted-foreground">
                This tutor hasn&apos;t added a description yet.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Subjects</CardTitle>
            <CardDescription>What this tutor teaches.</CardDescription>
          </CardHeader>
          <CardContent>
            {tutor.subjects.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {tutor.subjects.map((subject) => (
                  <Badge key={subject} variant="secondary" className="gap-1.5">
                    <BookOpen className="h-3.5 w-3.5" />
                    {subject}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm italic text-muted-foreground">No subjects listed yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Where you study together</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Classes
              </p>
              {tutor.classrooms.length > 0 ? (
                <ul className="space-y-2">
                  {tutor.classrooms.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/dashboard/student/classrooms/${c.id}`}
                        className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/40"
                      >
                        <span className="truncate font-medium">{c.name}</span>
                        {c.subject && (
                          <span className="ml-3 shrink-0 text-xs text-muted-foreground">
                            {c.subject}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm italic text-muted-foreground">None.</p>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                1v1 rooms
              </p>
              {tutor.one_to_one_rooms.length > 0 ? (
                <ul className="space-y-2">
                  {tutor.one_to_one_rooms.map((r) => (
                    <li key={r.id}>
                      <Link
                        href={`/dashboard/student/rooms/${r.id}`}
                        className="block truncate rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted/40"
                      >
                        {r.name ?? "1v1 room"}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm italic text-muted-foreground">None.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
