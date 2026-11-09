/**
 * Guest-only auth context. xtsy.one has no sign-in: there are no guest accounts, no
 * admin surface, and no database to authenticate against. Everything on the site is
 * public, and every enquiry finishes on WhatsApp.
 *
 * This keeps the provider and the `useUserAuth` / `useOptionalAuth` surface so callers
 * (SiteHeader, the /book flow via useOptionalAuth) keep compiling, while making no
 * backend call at all. `user` and `session` are permanently null, so any `user ? a : b`
 * branch resolves to the guest path -- which is already what visitors see.
 *
 * The sign-in methods remain on the type so no caller breaks, but they reject with a
 * clear message rather than silently appearing to succeed. Do not reintroduce real auth
 * against the inert backend stand-in: it resolves `data` to null, so the usual
 * `const { data: { session } } = await client.auth.getSession()` destructuring throws.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';

export interface UserProfile {
  id: string;
  email: string;
  phone: string | null;
}

export interface ExtendedUser {
  id: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  phoneNumber: string | null;
  emailVerified: boolean;
  metadata: { creationTime?: string; lastSignInTime?: string };
  providerData?: Array<{ providerId: string }>;
  profile?: UserProfile | null;
}

interface UserAuthContextType {
  user: ExtendedUser | null;
  session: null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (email: string, password: string) => Promise<void>;
  signInWithOTP: (email: string) => Promise<void>;
  verifyOTP: (email: string, token: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}

const UNAVAILABLE = 'Accounts are not available on this site. Please continue on WhatsApp.';

const UserAuthContext = createContext<UserAuthContextType | undefined>(undefined);

export function useUserAuth() {
  const ctx = useContext(UserAuthContext);
  if (!ctx) throw new Error('useUserAuth must be used within a UserAuthProvider');
  return ctx;
}

export function UserAuthProvider({ children }: { children: ReactNode }) {
  const value = useMemo<UserAuthContextType>(() => {
    const unavailable = async () => {
      throw new Error(UNAVAILABLE);
    };
    return {
      user: null,
      session: null,
      isLoading: false,
      isInitialized: true,
      error: null,
      signInEmail: unavailable,
      signUpEmail: unavailable,
      signInWithOTP: unavailable,
      verifyOTP: unavailable,
      resetPassword: unavailable,
      signInGoogle: unavailable,
      signOut: async () => {},
      clearError: () => {},
      updateProfile: unavailable,
    };
  }, []);

  return <UserAuthContext.Provider value={value}>{children}</UserAuthContext.Provider>;
}
