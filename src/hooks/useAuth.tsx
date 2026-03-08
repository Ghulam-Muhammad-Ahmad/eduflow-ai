import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole, AccountType } from "@/types/auth";

/**
 * Internal: Development logging helper (no-op to avoid ERR_CONNECTION_REFUSED in console).
 * Re-enable and point to a real ingest URL if you need agent logging.
 */
function devAgentLog(_path: string, _data: unknown) {
  // no-op: was causing ERR_CONNECTION_REFUSED to 127.0.0.1:7242
}

interface UserProfile {
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  account_type: AccountType | null;
  onboarding_completed_at: string | null;
  password_changed_at: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  profile: UserProfile | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName: string, roleOrAccountType: AppRole | AccountType) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  setRoleForOAuthUser: (role: AppRole) => Promise<{ error: Error | null }>;
  setAccountTypeForOAuthUser: (accountType: AccountType) => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  updateProfile: (displayName: string) => Promise<{ error: Error | null }>;
  updateEmail: (newEmail: string) => Promise<{ error: Error | null }>;
  updateAvatar: (avatarUrl: string) => Promise<{ error: Error | null }>;
  updateBio: (bio: string | null) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
  completeOnboarding: () => Promise<{ error: Error | null }>;
  setPasswordChanged: () => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching role:", error);
        return null;
      }

      return data?.role as AppRole | null;
    } catch (error) {
      console.error("Error fetching role:", error);
      return null;
    }
  };

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, avatar_url, bio, account_type, onboarding_completed_at, password_changed_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching profile:", error);
        return null;
      }

      const raw = data as (UserProfile & { account_type?: string; onboarding_completed_at?: string; password_changed_at?: string }) | null;
      if (!raw) return null;
      return {
        display_name: raw.display_name ?? null,
        avatar_url: raw.avatar_url ?? null,
        bio: raw.bio ?? null,
        account_type: (raw.account_type as AccountType) ?? null,
        onboarding_completed_at: raw.onboarding_completed_at ?? null,
        password_changed_at: raw.password_changed_at ?? null,
      };
    } catch (error) {
      console.error("Error fetching profile:", error);
      return null;
    }
  };

  const ensureOAuthUserProfile = async (userId: string, metadata: { full_name?: string; name?: string; avatar_url?: string; picture?: string } = {}) => {
    const displayName = metadata.full_name || metadata.name || "User";
    const avatarUrl = metadata.avatar_url || metadata.picture || null;

    const { error: profileError } = await supabase.from("profiles").upsert(
      { user_id: userId, display_name: displayName, avatar_url: avatarUrl, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    if (profileError) console.error("Error upserting OAuth profile:", profileError);
    else setProfile((prev) => ({ display_name: displayName, avatar_url: avatarUrl, bio: prev?.bio ?? null, account_type: prev?.account_type ?? null, onboarding_completed_at: prev?.onboarding_completed_at ?? null, password_changed_at: prev?.password_changed_at ?? null }));
  };

  const setRoleForOAuthUser = async (selectedRole: AppRole) => {
    if (!user) return { error: new Error("Not signed in") };
    try {
      const { error } = await supabase.from("user_roles").insert({
        user_id: user.id,
        role: selectedRole,
      });
      if (error) throw error;
      setRole(selectedRole);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const setAccountTypeForOAuthUser = async (accountType: AccountType) => {
    if (!user) return { error: new Error("Not signed in") };
    try {
      const role: AppRole = accountType === "business" ? "admin" : accountType === "tutor" ? "teacher" : "student";
      const { error: roleError } = await supabase.from("user_roles").insert({
        user_id: user.id,
        role,
      });
      if (roleError) throw roleError;
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ account_type: accountType, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
      if (profileError) throw profileError;
      setRole(role);
      setProfile((prev) => prev ? { ...prev, account_type: accountType } : null);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(async () => {
            const fetchedRole = await fetchUserRole(session.user.id);
            const fetchedProfile = await fetchUserProfile(session.user.id);
            if (!fetchedRole && session.user.app_metadata?.provider) {
              await ensureOAuthUserProfile(session.user.id, session.user.user_metadata || {});
            }
            setRole(fetchedRole);
            setProfile(
              fetchedProfile ??
              (fetchedRole
                ? {
                    display_name:
                      session.user.user_metadata?.full_name ||
                      session.user.user_metadata?.name ||
                      null,
                    avatar_url:
                      session.user.user_metadata?.avatar_url ||
                      session.user.user_metadata?.picture ||
                      null,
                    bio: null,
                    account_type: null,
                    onboarding_completed_at: null,
                    password_changed_at: null,
                  }
                : null)
            );
          }, 0);
        } else {
          setRole(null);
          setProfile(null);
        }

        setLoading(false);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        const fetchedRole = await fetchUserRole(session.user.id);
        const fetchedProfile = await fetchUserProfile(session.user.id);
        if (!fetchedRole && session.user.app_metadata?.provider) {
          await ensureOAuthUserProfile(session.user.id, session.user.user_metadata || {});
        }
        setRole(fetchedRole);
        setProfile(
          fetchedProfile ??
          (fetchedRole
            ? {
                display_name:
                  session.user.user_metadata?.full_name ||
                  session.user.user_metadata?.name ||
                  null,
                avatar_url:
                  session.user.user_metadata?.avatar_url ||
                  session.user.user_metadata?.picture ||
                  null,
                bio: null,
                account_type: null,
                onboarding_completed_at: null,
                password_changed_at: null,
              }
            : null)
        );
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, displayName: string, roleOrAccountType: AppRole | AccountType) => {
    const isAccountType = (v: string): v is AccountType =>
      v === "business" || v === "student";
    const selectedRole: AppRole = isAccountType(roleOrAccountType)
      ? roleOrAccountType === "business"
        ? "admin"
        : "student"
      : roleOrAccountType;
    const accountType: AccountType | null = isAccountType(roleOrAccountType) ? roleOrAccountType : null;
    try {
      // #region agent log
      devAgentLog(
        "c33afbad-741d-479c-95b3-1a38165830f0",
        {
          sessionId: "debug-session",
          runId: "pre-fix",
          hypothesisId: "A",
          location: "useAuth.tsx:86",
          message: "signUp start",
          data: {
            hasEmail: Boolean(email),
            displayNameLength: displayName?.length ?? 0,
            selectedRole,
          },
          timestamp: Date.now(),
        }
      );
      // #endregion
      const redirectUrl = `${window.location.origin}/`;

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            display_name: displayName,
            role: selectedRole,
          },
        },
      });

      if (error) throw error;

      // #region agent log
      devAgentLog(
        "c33afbad-741d-479c-95b3-1a38165830f0",
        {
          sessionId: "debug-session",
          runId: "pre-fix",
          hypothesisId: "A",
          location: "useAuth.tsx:101",
          message: "signUp response",
          data: {
            hasUser: Boolean(data.user),
            hasSession: Boolean(data.session),
            userId: data.user?.id ?? null,
            sessionUserId: data.session?.user?.id ?? null,
            errorMessage: (error as { message?: string } | null)?.message ?? null,
          },
          timestamp: Date.now(),
        }
      );
      // #endregion

      if (data.user) {
        // user_roles row is created by handle_new_user trigger (from options.data.role); no client insert needed (avoids RLS when session is null after signup)
        // Update profile with display name and optional account_type (onboarding_completed_at set by onboarding)
        const profileUpdate: { display_name: string; account_type?: AccountType; updated_at: string } = {
          display_name: displayName,
          updated_at: new Date().toISOString(),
        };
        if (accountType) profileUpdate.account_type = accountType;
        const { error: profileError } = await supabase
          .from("profiles")
          .update(profileUpdate)
          .eq("user_id", data.user.id);

        if (profileError) {
          console.error("Error updating profile:", profileError);
        }

        setRole(selectedRole);
        setProfile((prev) => ({
          ...prev,
          display_name: displayName,
          avatar_url: prev?.avatar_url ?? null,
          bio: prev?.bio ?? null,
          account_type: accountType ?? prev?.account_type ?? null,
          onboarding_completed_at: prev?.onboarding_completed_at ?? null,
          password_changed_at: prev?.password_changed_at ?? null,
        }));
      }

      return { error: null };
    } catch (error) {
      // #region agent log
      devAgentLog(
        "c33afbad-741d-479c-95b3-1a38165830f0",
        {
          sessionId: "debug-session",
          runId: "pre-fix",
          hypothesisId: "D",
          location: "useAuth.tsx:129",
          message: "signUp error",
          data: {
            errorMessage: (error as Error)?.message ?? "unknown",
            errorName: (error as Error)?.name ?? "unknown",
          },
          timestamp: Date.now(),
        }
      );
      // #endregion
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const getRedirectUrl = () => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/auth/callback`;
  };

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: getRedirectUrl() },
      });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRole(null);
    setProfile(null);
  };

  const resetPassword = async (email: string) => {
    try {
      const redirectUrl = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) throw error;

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const updateProfile = async (displayName: string) => {
    try {
      if (!user) throw new Error("No user logged in");

      // Update auth metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: { display_name: displayName },
      });

      if (authError) throw authError;

      // Update profile table
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ display_name: displayName, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);

      if (profileError) throw profileError;

      setProfile((prev) => ({
        display_name: displayName,
        avatar_url: prev?.avatar_url ?? null,
        bio: prev?.bio ?? null,
        account_type: prev?.account_type ?? null,
        onboarding_completed_at: prev?.onboarding_completed_at ?? null,
        password_changed_at: prev?.password_changed_at ?? null,
      }));
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const updateEmail = async (newEmail: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail,
      });

      if (error) throw error;

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const updateAvatar = async (avatarUrl: string) => {
    try {
      if (!user) throw new Error("No user logged in");

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);

      if (profileError) throw profileError;

      setProfile((prev) => ({
        display_name: prev?.display_name ?? null,
        avatar_url: avatarUrl,
        bio: prev?.bio ?? null,
        account_type: prev?.account_type ?? null,
        onboarding_completed_at: prev?.onboarding_completed_at ?? null,
        password_changed_at: prev?.password_changed_at ?? null,
      }));
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const updateBio = async (bio: string | null) => {
    try {
      if (!user) throw new Error("No user logged in");
      const { error } = await supabase
        .from("profiles")
        .update({ bio: bio ?? null, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
      if (error) throw error;
      setProfile((prev) => (prev ? { ...prev, bio: bio ?? null } : null));
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const refreshProfile = async () => {
    if (!user) return;
    const updatedProfile = await fetchUserProfile(user.id);
    setProfile(updatedProfile);
  };

  const completeOnboarding = async () => {
    try {
      if (!user) throw new Error("No user logged in");
      const { error } = await supabase
        .from("profiles")
        .update({ onboarding_completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
      if (error) throw error;
      setProfile((prev) => prev ? { ...prev, onboarding_completed_at: new Date().toISOString() } : null);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const setPasswordChanged = async () => {
    try {
      if (!user) throw new Error("No user logged in");
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("profiles")
        .update({ password_changed_at: now, updated_at: now })
        .eq("user_id", user.id);
      if (error) throw error;
      setProfile((prev) => (prev ? { ...prev, password_changed_at: now } : null));
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        profile,
        loading,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
        setRoleForOAuthUser,
        setAccountTypeForOAuthUser,
        resetPassword,
        updatePassword,
        updateProfile,
        updateEmail,
        updateAvatar,
        updateBio,
        refreshProfile,
        completeOnboarding,
        setPasswordChanged,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
