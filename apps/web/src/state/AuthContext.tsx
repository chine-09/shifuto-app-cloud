import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import * as cognito from "../lib/auth/cognitoClient";
import { fetchAccountPlan } from "../lib/api/cloudStateClient";

export type Plan = "free" | "paid";

type AuthState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in"; email: string; idToken: string; plan: Plan };

type AuthContextValue = {
  auth: AuthState;
  signUp: (email: string, password: string) => Promise<void>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
  resendConfirmationCode: (email: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  refreshPlan: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * The free tier never touches this — it has no login and works entirely
 * offline against local state. This context only matters once a user signs
 * up for the paid tier (cloud auto-save + billing).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });

  const loadFromSession = useCallback(async () => {
    try {
      const session = await cognito.getCurrentSession();
      if (!session) {
        setAuth({ status: "signed-out" });
        return;
      }
      const idToken = session.getIdToken();
      const email = (idToken.payload.email as string) ?? "";
      const plan = await fetchAccountPlan(idToken.getJwtToken()).catch(() => "free" as const);
      setAuth({ status: "signed-in", email, idToken: idToken.getJwtToken(), plan });
    } catch {
      setAuth({ status: "signed-out" });
    }
  }, []);

  useEffect(() => {
    loadFromSession();
  }, [loadFromSession]);

  async function handleSignIn(email: string, password: string) {
    await cognito.signIn(email, password);
    await loadFromSession();
  }

  function handleSignOut() {
    cognito.signOut();
    setAuth({ status: "signed-out" });
  }

  async function refreshPlan() {
    if (auth.status !== "signed-in") return;
    const plan = await fetchAccountPlan(auth.idToken).catch(() => auth.plan);
    setAuth({ ...auth, plan });
  }

  return (
    <AuthContext.Provider
      value={{
        auth,
        signUp: cognito.signUp,
        confirmSignUp: cognito.confirmSignUp,
        resendConfirmationCode: cognito.resendConfirmationCode,
        signIn: handleSignIn,
        signOut: handleSignOut,
        refreshPlan,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
