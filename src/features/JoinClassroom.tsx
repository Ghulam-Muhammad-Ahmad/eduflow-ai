import { useMemo } from "react";
import { useRouter } from "next/router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useJoinClassroom } from "@/hooks/useClassrooms";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Loader2, UserPlus } from "lucide-react";

type InviteClassroom = {
  id: string;
  name: string;
  description: string | null;
  subject: string | null;
  teacher_name: string | null;
};

const JoinClassroom = () => {
  const router = useRouter();
  const { code } = router.query;
  const { user, role } = useAuth();
  const { toast } = useToast();
  const joinClassroom = useJoinClassroom();

  const normalizedCode = useMemo(() => code?.toUpperCase() ?? "", [code]);

  const { data: classroom, isLoading, error } = useQuery({
    queryKey: ["classroom-invite", normalizedCode],
    queryFn: async () => {
      if (!normalizedCode) return null;
      const { data, error: rpcError } = await supabase.rpc("get_classroom_by_join_code", {
        code: normalizedCode,
      });

      if (rpcError) throw rpcError;
      return (data?.[0] as InviteClassroom) || null;
    },
    enabled: !!normalizedCode,
  });

  const handleJoin = async () => {
    if (!normalizedCode) return;
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to join this classroom.",
      });
      router.push("/auth");
      return;
    }
    if (role !== "student") {
      toast({
        title: "Only students can join",
        description: "Switch to a student account to join this class.",
        variant: "destructive",
      });
      return;
    }

    await joinClassroom.mutateAsync(normalizedCode);
    router.push("/dashboard/student/classrooms");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Join Classroom
          </CardTitle>
          <CardDescription>
            Review class details and join in one step.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading classroom details...
            </div>
          )}

          {!isLoading && error && (
            <div className="text-sm text-destructive">
              Unable to load classroom details. Please check your invite link.
            </div>
          )}

          {!isLoading && !error && !classroom && (
            <div className="text-sm text-muted-foreground">
              Classroom not found. The invite link may be invalid or expired.
            </div>
          )}

          {classroom && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold">{classroom.name}</h2>
                {classroom.subject && (
                  <p className="text-sm text-muted-foreground">{classroom.subject}</p>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Teacher</span>
                <Badge variant="secondary">{classroom.teacher_name || "Teacher"}</Badge>
              </div>
              {classroom.description && (
                <p className="text-sm text-muted-foreground">{classroom.description}</p>
              )}
              <div className="pt-2">
                <Button
                  className="w-full gap-2"
                  onClick={handleJoin}
                  disabled={joinClassroom.isPending}
                >
                  {joinClassroom.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  {user ? "Join Classroom" : "Sign in to join"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default JoinClassroom;
