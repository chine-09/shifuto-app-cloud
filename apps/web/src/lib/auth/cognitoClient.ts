import {
  CognitoUser,
  CognitoUserPool,
  CognitoUserSession,
  AuthenticationDetails,
} from "amazon-cognito-identity-js";

let pool: CognitoUserPool | undefined;

/**
 * Lazy: the free tier runs with these env vars unset (no login at all), so
 * constructing this eagerly at module load would throw for every free-tier
 * user on every page load. Only paid-tier code paths (AccountPage, this
 * module's own exports) ever call this.
 */
function getUserPool(): CognitoUserPool {
  if (!pool) {
    const UserPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
    const ClientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
    if (!UserPoolId || !ClientId) {
      throw new Error("Cognito is not configured (VITE_COGNITO_USER_POOL_ID / VITE_COGNITO_CLIENT_ID missing)");
    }
    pool = new CognitoUserPool({ UserPoolId, ClientId });
  }
  return pool;
}

/**
 * Thin promise wrapper around amazon-cognito-identity-js (the official,
 * lightweight Cognito SDK — SRP auth happens entirely in the browser, no
 * password ever leaves it in plaintext). Kept separate from AuthContext.tsx
 * so the React-specific state lives in one place and this file stays a pure
 * client.
 */

export function signUp(email: string, password: string): Promise<void> {
  return new Promise((resolve, reject) => {
    getUserPool().signUp(email, password, [], [], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function confirmSignUp(email: string, code: string): Promise<void> {
  const user = new CognitoUser({ Username: email, Pool: getUserPool() });
  return new Promise((resolve, reject) => {
    user.confirmRegistration(code, true, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function resendConfirmationCode(email: string): Promise<void> {
  const user = new CognitoUser({ Username: email, Pool: getUserPool() });
  return new Promise((resolve, reject) => {
    user.resendConfirmationCode((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function signIn(email: string, password: string): Promise<CognitoUserSession> {
  const user = new CognitoUser({ Username: email, Pool: getUserPool() });
  const authDetails = new AuthenticationDetails({ Username: email, Password: password });
  return new Promise((resolve, reject) => {
    user.authenticateUser(authDetails, {
      onSuccess: (session) => resolve(session),
      onFailure: (err) => reject(err),
    });
  });
}

export function signOut(): void {
  getUserPool().getCurrentUser()?.signOut();
}

/** Resolves to a valid (auto-refreshed) session, or null if nobody is signed in. */
export function getCurrentSession(): Promise<CognitoUserSession | null> {
  if (!import.meta.env.VITE_COGNITO_USER_POOL_ID || !import.meta.env.VITE_COGNITO_CLIENT_ID) {
    return Promise.resolve(null); // Cognito unconfigured — free-tier local dev, never signed in
  }
  const user = getUserPool().getCurrentUser();
  if (!user) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err) reject(err);
      else resolve(session);
    });
  });
}
