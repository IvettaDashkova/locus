import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { authConfig } from "./auth.config";

/**
 * Full Auth.js instance used by the route handler and server code. It extends the edge-safe
 * `authConfig` with an email/password Credentials provider backed by the `users` table. OAuth
 * providers (if configured) come from `authConfig`. Sessions are JWT; the app is public and only
 * *writes* require a session.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;

        const [user] = await getDb().select().from(users).where(eq(users.email, email)).limit(1);
        if (!user) return null;
        if (!(await verifyPassword(password, user.passwordHash))) return null;

        return { id: user.id, email: user.email, name: user.name ?? user.email };
      },
    }),
  ],
});
