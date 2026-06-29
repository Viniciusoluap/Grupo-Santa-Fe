import { redirect } from "next/navigation";
import type { Session } from "next-auth";

export type Role = "admin" | "corretor" | "colaborador" | "cliente";

function getSessionRole(session: Session | null): Role | null {
  if (!session) return null;
  return ((session.user as { role?: string })?.role as Role) ?? null;
}

export function hasRole(session: Session | null, ...roles: Role[]): boolean {
  const role = getSessionRole(session);
  if (!role) return false;
  return roles.includes(role);
}

export function requirePageRole(session: Session | null, ...roles: Role[]): void {
  if (!hasRole(session, ...roles)) {
    redirect("/admin");
  }
}

export function requireActionRole(session: Session | null, ...roles: Role[]): void {
  if (!session) throw new Error("Não autorizado");
  if (!hasRole(session, ...roles)) throw new Error("Não autorizado");
}
