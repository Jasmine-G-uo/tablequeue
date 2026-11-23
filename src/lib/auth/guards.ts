import type { Role } from "./users";

/** The parts of an Auth.js session the guards rely on. */
export interface SessionLike {
  user?: { id?: string; role?: string } | null;
}

export interface SessionUser {
  id: string;
  role: Role;
}

export type GuardResult =
  | { ok: true; user: SessionUser }
  | { ok: false; status: 401; code: "unauthenticated" }
  | { ok: false; status: 403; code: "forbidden" };

type GetSession = () => Promise<SessionLike | null>;

/** Server-side check for guest-only actions and pages (PRD §6.2). */
export function requireGuest(getSession: GetSession): Promise<GuardResult> {
  return requireRole(getSession, "guest");
}

/** Server-side check for staff-only actions and pages (PRD §6.2). */
export function requireStaff(getSession: GetSession): Promise<GuardResult> {
  return requireRole(getSession, "staff");
}

async function requireRole(getSession: GetSession, role: Role): Promise<GuardResult> {
  const user = (await getSession())?.user;
  if (!user?.id) return { ok: false, status: 401, code: "unauthenticated" };
  if (user.role !== role) return { ok: false, status: 403, code: "forbidden" };
  return { ok: true, user: { id: user.id, role } };
}

/** For pages: unauthenticated visitors go to sign-in, signed-in users with the wrong role to /forbidden. */
export async function guardPage(
  result: GuardResult,
  redirect: (url: string) => never,
): Promise<SessionUser> {
  if (result.ok) return result.user;
  return redirect(result.status === 401 ? "/sign-in" : "/forbidden");
}
