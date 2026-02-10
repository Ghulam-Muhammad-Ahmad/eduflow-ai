import { useRouter } from "next/router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { AppRole } from "@/types/auth";

interface WithAuthOptions {
  allowedRoles?: AppRole[];
  redirectTo?: string;
}

export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options: WithAuthOptions = {}
) {
  return function AuthenticatedComponent(props: P) {
    const router = useRouter();
    const { user, role, loading } = useAuth();
    const { allowedRoles, redirectTo } = options;

    useEffect(() => {
      if (loading) return;

      if (!user) {
        router.push(redirectTo || "/auth");
        return;
      }

      if (allowedRoles && role && !allowedRoles.includes(role)) {
        switch (role) {
          case "teacher":
            router.push("/dashboard/teacher");
            break;
          case "student":
            router.push("/dashboard/student");
            break;
          case "admin":
            router.push("/dashboard/admin");
            break;
          default:
            router.push("/");
        }
        return;
      }
    }, [user, role, loading, router, allowedRoles, redirectTo]);

    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      );
    }

    if (!user) {
      return null;
    }

    if (allowedRoles && role && !allowedRoles.includes(role)) {
      return null;
    }

    return <Component {...props} />;
  };
}
