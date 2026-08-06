import { useMemo, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useOneToOneRooms } from "@/hooks/useOneToOneRooms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { UserCircle, Users, ArrowLeft, Eye, Search } from "lucide-react";
import { format } from "date-fns";

export default function TeacherOneToOneRoomsList() {
  const { oneToOneRooms, isLoading } = useOneToOneRooms();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredRooms = useMemo(() => {
    if (!searchQuery.trim()) return oneToOneRooms ?? [];
    const q = searchQuery.toLowerCase().trim();
    return (oneToOneRooms ?? []).filter((room) => {
      const name = (room.name ?? "").toLowerCase();
      const studentName = (room.studentProfile?.display_name ?? "").toLowerCase();
      return name.includes(q) || studentName.includes(q);
    });
  }, [oneToOneRooms, searchQuery]);

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6 min-w-0 w-full max-w-[1600px]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="text-center sm:text-left">
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
              1v1 Rooms
            </h1>
            <p className="text-muted-foreground mt-1.5">
              One-to-one rooms with your students. Use assignments, quizzes, and sessions in each room.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild className="gap-2 shrink-0 w-full sm:w-auto">
            <Link href="/dashboard/teacher/students">
              <ArrowLeft className="h-4 w-4" />
              My Students
            </Link>
          </Button>
        </div>

        {!isLoading && (!oneToOneRooms || oneToOneRooms.length === 0) && (
          <Card className="border-dashed border-2 border-muted-foreground/20 bg-muted/20 max-w-md mx-auto rounded-xl">
            <CardContent className="flex flex-col items-center justify-center py-12 px-8">
              <div className="rounded-full bg-primary/10 p-5 mb-4">
                <Users className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No 1v1 rooms yet</h3>
              <p className="text-sm text-muted-foreground text-center max-w-sm">
                Your workspace owner can create 1v1 rooms and assign you to a student. You will see them here.
              </p>
            </CardContent>
          </Card>
        )}

        {!isLoading && oneToOneRooms && oneToOneRooms.length > 0 && (
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden />
                <Input
                  type="search"
                  placeholder="Search by room name or student..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  aria-label="Search 1v1 rooms"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/80 bg-muted/30">
                    <th className="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Room
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Student
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground hidden sm:table-cell">
                      Created
                    </th>
                    <th className="px-6 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground w-24">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredRooms.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-sm text-muted-foreground">
                        No rooms match &quot;{searchQuery}&quot;. Try a different search.
                      </td>
                    </tr>
                  ) : (
                    filteredRooms.map((room) => (
                      <tr key={room.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-3.5">
                          <Link
                            href={`/dashboard/teacher/rooms/${room.id}`}
                            className="font-medium text-foreground hover:text-primary transition-colors inline-flex items-center gap-2"
                          >
                            <UserCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                            {room.name || "1v1 room"}
                          </Link>
                        </td>
                        <td className="px-6 py-3.5 text-muted-foreground">
                          {room.studentProfile?.display_name ?? "—"}
                        </td>
                        <td className="px-6 py-3.5 text-muted-foreground text-sm hidden sm:table-cell">
                          {room.created_at ? format(new Date(room.created_at), "MMM d, yyyy") : "—"}
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <Button variant="default" size="sm" asChild className="gap-2">
                            <Link
                              href={`/dashboard/teacher/rooms/${room.id}`}
                              className="inline-flex items-center gap-2"
                              aria-label={`View ${room.name || "1v1 room"}`}
                            >
                              <Eye className="h-4 w-4" />
                              View
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border">
              <div className="h-10 bg-muted/50 rounded-md max-w-sm animate-pulse" />
            </div>
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                  <div className="h-4 bg-muted rounded flex-1 max-w-[160px]" />
                  <div className="h-4 bg-muted rounded w-32" />
                  <div className="h-4 bg-muted rounded w-20 hidden sm:block" />
                  <div className="h-9 bg-muted rounded w-20" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
