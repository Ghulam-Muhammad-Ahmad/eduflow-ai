import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

type AppRole = "teacher" | "student" | "admin";

interface UserProfile {
  display_name: string | null;
  avatar_url: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  profile: UserProfile | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName: string, role: AppRole) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  updateProfile: (displayName: string) => Promise<{ error: Error | null }>;
  updateEmail: (newEmail: string) => Promise<{ error: Error | null }>;
  updateAvatar: (avatarUrl: string) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
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
        .select("display_name, avatar_url")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching profile:", error);
        return null;
      }

      return (data ?? null) as UserProfile | null;
    } catch (error) {
      console.error("Error fetching profile:", error);
      return null;
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        // Defer role fetching with setTimeout to prevent deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchUserRole(session.user.id).then(setRole);
            fetchUserProfile(session.user.id).then(setProfile);
          }, 0);
        } else {
          setRole(null);
          setProfile(null);
        }

        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchUserRole(session.user.id).then(setRole);
        fetchUserProfile(session.user.id).then(setProfile);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, displayName: string, selectedRole: AppRole) => {
    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/c33afbad-741d-479c-95b3-1a38165830f0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A',location:'useAuth.tsx:86',message:'signUp start',data:{hasEmail:Boolean(email),displayNameLength:displayName?.length ?? 0,selectedRole},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      const redirectUrl = `${window.location.origin}/`;

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            display_name: displayName,
          },
        },
      });

      if (error) throw error;

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/c33afbad-741d-479c-95b3-1a38165830f0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A',location:'useAuth.tsx:101',message:'signUp response',data:{hasUser:Boolean(data.user),hasSession:Boolean(data.session),userId:data.user?.id ?? null,sessionUserId:data.session?.user?.id ?? null,errorMessage:error?.message ?? null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      if (data.user) {
        const { data: sessionData } = await supabase.auth.getSession();
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/c33afbad-741d-479c-95b3-1a38165830f0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'pre-fix',hypothesisId:'B',location:'useAuth.tsx:106',message:'pre user_roles insert',data:{targetUserId:data.user.id,sessionUserId:sessionData.session?.user?.id ?? null,selectedRole},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        // Create user role
        const { error: roleError } = await supabase.from("user_roles").insert({
          user_id: data.user.id,
          role: selectedRole,
        });

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/c33afbad-741d-479c-95b3-1a38165830f0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'pre-fix',hypothesisId:'C',location:'useAuth.tsx:112',message:'user_roles insert result',data:{hasRoleError:Boolean(roleError),roleErrorCode:roleError?.code ?? null,roleErrorMessage:roleError?.message ?? null},timestamp:Date.now()})}).catch(()=>{});
        // #endregion

        if (roleError) {
          console.error("Error creating role:", roleError);
          throw roleError;
        }

        // Update profile with display name
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ display_name: displayName })
          .eq("user_id", data.user.id);

        if (profileError) {
          console.error("Error updating profile:", profileError);
        }

        setRole(selectedRole);
      }

      return { error: null };
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/c33afbad-741d-479c-95b3-1a38165830f0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'pre-fix',hypothesisId:'D',location:'useAuth.tsx:129',message:'signUp error',data:{errorMessage:(error as Error)?.message ?? 'unknown',errorName:(error as Error)?.name ?? 'unknown'},timestamp:Date.now()})}).catch(()=>{});
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
      }));
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

  return (
    <AuthContext.Provider value={{ user, session, role, profile, loading, signUp, signIn, signOut, resetPassword, updatePassword, updateProfile, updateEmail, updateAvatar, refreshProfile }}>
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
