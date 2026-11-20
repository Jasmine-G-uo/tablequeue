import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { Database } from "@/lib/db/pool";
import { authenticate } from "./authenticate";
import type { Role } from "./users";

/** PRD US-01: sessions expire after at most 8 hours. */
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

interface TokenLike {
  sub?: string;
  role?: Role;
  [key: string]: unknown;
}

interface SessionShape {
  user?: { id?: string; role?: Role; email?: string | null; [key: string]: unknown };
  expires: string;
}

/** Copies only the user id and role into the JWT at sign-in. */
export function jwtCallback({
  token,
  user,
}: {
  token: TokenLike;
  user?: { id?: string; role?: Role; [key: string]: unknown };
}): TokenLike {
  if (user?.id) return { ...token, sub: user.id, role: user.role };
  return token;
}

/** Exposes id and role on `session.user` so the guards can check them. */
export function sessionCallback({
  session,
  token,
}: {
  session: SessionShape;
  token: TokenLike;
}): SessionShape {
  return { ...session, user: { ...session.user, id: token.sub, role: token.role } };
}

/** Sign-out removes the session cookie and sends the user back to sign-in. */
export function signOutToSignIn(
  signOut: (options: { redirectTo: string }) => Promise<unknown>,
): Promise<unknown> {
  return signOut({ redirectTo: "/sign-in" });
}

export function buildAuthConfig({
  db,
  nodeEnv,
}: {
  db: Database;
  nodeEnv: "development" | "test" | "production";
}): NextAuthConfig {
  const secure = nodeEnv === "production";
  return {
    session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
    jwt: { maxAge: SESSION_MAX_AGE_SECONDS },
    pages: { signIn: "/sign-in" },
    useSecureCookies: secure,
    cookies: {
      sessionToken: {
        name: `${secure ? "__Secure-" : ""}authjs.session-token`,
        options: { httpOnly: true, sameSite: "lax", path: "/", secure },
      },
    },
    providers: [
      Credentials({
        credentials: { email: {}, password: {} },
        // Every failure (bad input, unknown email, wrong password, lockout) returns null, which
        // Auth.js reports as one generic CredentialsSignin error.
        async authorize(credentials) {
          const result = await authenticate(db, {
            email: credentials?.email,
            password: credentials?.password,
          });
          return result.ok ? result.value : null;
        },
      }),
    ],
    callbacks: {
      jwt: ({ token, user }) => jwtCallback({ token, user: user as TokenLike }) as typeof token,
      session: ({ session, token }) =>
        sessionCallback({ session, token } as unknown as {
          session: SessionShape;
          token: TokenLike;
        }) as unknown as typeof session,
    },
  };
}
