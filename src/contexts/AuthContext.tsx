import { createContext, useContext, useEffect, useRef, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { logAuditEvent } from "@/hooks/useAuditLog";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  loading: boolean;
  sessionExpired: boolean;
  onSessionRenewed: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  // Track whether the sign-out was triggered manually by the user
  const manualSignOut = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT') {
          if (manualSignOut.current) {
            // User clicked "Sign out" — clear state and redirect
            manualSignOut.current = false;
            setSession(null);
            setUser(null);
          } else {
            // Session expired or was invalidated externally — show renewal dialog
            // Keep the previous user state visible so the app doesn't flash blank
            setSessionExpired(true);
          }
          return;
        }

        if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
          setSessionExpired(false);
        }

        setSession(session);
        setUser(session?.user ?? null);

        if (event === 'SIGNED_IN' && session?.user) {
          const provider = session.user.app_metadata?.provider;
          if (provider && provider !== 'email') {
            setTimeout(() => {
              logAuditEvent(session.user.id, 'oauth_login', 'user', session.user.id, {
                provider,
                email: session.user.email,
              });
            }, 0);
          }
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const onSessionRenewed = () => {
    // Re-read session from Supabase after a successful refreshSession() call
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setSessionExpired(false);
    });
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: fullName },
      },
    });

    if (error) {
      toast.error(error.message);
      return { error };
    }

    if (data.user) {
      await logAuditEvent(data.user.id, 'signup', 'user', data.user.id, { email });
    }

    toast.success("Account created successfully!");
    navigate("/dashboard");
    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast.error(error.message);
      return { error };
    }

    if (data.user) {
      await logAuditEvent(data.user.id, 'login', 'user', data.user.id, { email });
    }

    toast.success("Signed in successfully!");
    navigate("/dashboard");
    return { error: null };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      toast.error(error.message);
      return { error };
    }

    return { error: null };
  };

  const signOut = async () => {
    try {
      if (user) {
        await logAuditEvent(user.id, 'logout', 'user', user.id, { email: user.email }).catch(() => {});
      }

      manualSignOut.current = true;
      await supabase.auth.signOut({ scope: 'local' });

      setUser(null);
      setSession(null);
      setSessionExpired(false);

      toast.success("Saiu com sucesso!");
      navigate("/");
    } catch (error) {
      console.error("Sign out error:", error);
      manualSignOut.current = false;
      setUser(null);
      setSession(null);
      navigate("/");
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      signUp,
      signIn,
      signInWithGoogle,
      signOut,
      loading,
      sessionExpired,
      onSessionRenewed,
    }}>
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
