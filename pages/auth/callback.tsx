import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          setStatus("error");
          router.replace("/auth?error=session");
          return;
        }

        if (session?.user) {
          setStatus("success");
          const { data: roleRow } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", session.user.id)
            .maybeSingle();
          const role = roleRow?.role;
          if (!role) {
            router.replace("/onboarding/business");
            return;
          }
          if (role === "teacher" || role === "student") {
            const { data: profileRow } = await supabase
              .from("profiles")
              .select("password_changed_at")
              .eq("user_id", session.user.id)
              .maybeSingle();
            if (!profileRow?.password_changed_at) {
              router.replace("/onboarding/change-password");
              return;
            }
          }
          if (role === "teacher") router.replace("/dashboard/teacher");
          else if (role === "admin") router.replace("/dashboard/owner");
          else router.replace("/dashboard/student");
          return;
        }

        router.replace("/auth");
      } catch {
        setStatus("error");
        router.replace("/auth");
      }
    };

    handleCallback();
  }, [router, router.isReady]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Signing you in...</p>
        </div>
      </div>
    );
  }

  return null;
}
