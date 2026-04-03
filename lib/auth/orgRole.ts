export const ORG_ROLES = ["admin", "clerk", "cashier"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export function parseOrgRole(raw: string | null | undefined): OrgRole | null {
  if (raw == null) return null;
  const s = raw.trim().toLowerCase();
  return ORG_ROLES.includes(s as OrgRole) ? (s as OrgRole) : null;
}

export function isOrgAdmin(role: string | null | undefined): boolean {
  return role === "admin";
}
