export type AuthenticatedUser = { id: string };
export type OrganizationMembership = { organization_id: string; user_id: string; role: "owner" | "admin" | "member" };

export class AccessDeniedError extends Error {
  constructor(message = "Access denied") { super(message); this.name = "AccessDeniedError"; }
}

export function requireAuthenticatedUser(user: AuthenticatedUser | null): AuthenticatedUser {
  if (!user) throw new AccessDeniedError("Authentication required");
  return user;
}

export function authorizeOrganization(user: AuthenticatedUser | null, organizationId: string, memberships: OrganizationMembership[]) {
  const authenticated = requireAuthenticatedUser(user);
  const membership = memberships.find((item) => item.user_id === authenticated.id && item.organization_id === organizationId);
  if (!membership) throw new AccessDeniedError();
  return membership;
}
