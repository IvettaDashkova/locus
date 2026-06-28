"use client";

import { createContext, useContext, type ReactNode } from "react";

export type AuthUser = { name?: string | null; email?: string | null };

type AuthValue = { user: AuthUser | null; isLoggedIn: boolean };

const AuthContext = createContext<AuthValue>({ user: null, isLoggedIn: false });

/** Carries the server-resolved session down to client components (no extra /api/auth round-trip). */
export function AuthProvider({ user, children }: { user: AuthUser | null; children: ReactNode }) {
  return <AuthContext.Provider value={{ user, isLoggedIn: Boolean(user) }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
