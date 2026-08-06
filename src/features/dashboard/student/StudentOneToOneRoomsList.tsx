import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useOneToOneRooms } from "@/hooks/useOneToOneRooms";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { User, Users } from "lucide-react";

export default function StudentOneToOneRoomsList() {
  const { oneToOneRooms, isLoading } = useOneToOneRooms();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">1v1 Rooms</h1>
          <p className="text-muted-foreground mt-1">
            Your one-to-one rooms with tutors. Check assignments, quizzes, and sessions here.
          </p>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : oneToOneRooms.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg">No 1v1 rooms yet</h3>
              <p className="text-sm text-muted-foreground mt-1 text-center max-w-sm">
                Your workspace owner can add you to a 1v1 room with a tutor. You will see them here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {oneToOneRooms.map((room) => (
              <Card key={room.id} className="transition-colors">
                <CardContent className="flex items-center gap-4 pt-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">
                      {room.name || "1v1 room"}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {room.tutorProfile?.display_name ?? "Tutor"}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/student/sessions`}>
                      Sessions
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
