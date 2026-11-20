import NextAuth from "next-auth";
import { buildAuthConfig } from "@/lib/auth/config";
import { getPool } from "@/lib/db/pool";

// Lazy config: the database pool is only created when a request needs it, never at build time.
export const { handlers, auth, signIn, signOut } = NextAuth(() =>
  buildAuthConfig({
    db: getPool(),
    nodeEnv: process.env.NODE_ENV === "production" ? "production" : "development",
  }),
);
