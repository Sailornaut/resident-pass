/**
 * Role-based access control helpers.
 *
 * Tenant isolation rule: every check requires BOTH a role AND the target
 * community. Never trust a community_id supplied by the client alone —
 * always resolve it from the caller's memberships server-side.
 */

import type { Membership, MembershipRole } from "@/lib/db/types";

export interface AuthorizedContext {
  userId: string;
  memberships: Membership[];
}

function activeMemberships(ctx: AuthorizedContext): Membership[] {
  return ctx.memberships.filter((m) => m.status === "active");
}

/** All communities where the user holds a given role (or any role). */
export function communitiesWithRole(
  ctx: AuthorizedContext,
  role?: MembershipRole
): string[] {
  return activeMemberships(ctx)
    .filter((m) => (role ? m.role === role : true))
    .map((m) => m.community_id);
}

export function isResidentOf(ctx: AuthorizedContext, communityId: string): boolean {
  return activeMemberships(ctx).some(
    (m) => m.community_id === communityId && m.role === "resident"
  );
}

export function isAdminOf(ctx: AuthorizedContext, communityId: string): boolean {
  return activeMemberships(ctx).some(
    (m) =>
      m.community_id === communityId &&
      (m.role === "admin" || m.role === "platform_admin")
  );
}

export function isVerifierOf(ctx: AuthorizedContext, communityId: string): boolean {
  return activeMemberships(ctx).some(
    (m) =>
      m.community_id === communityId &&
      (m.role === "verifier" || m.role === "admin" || m.role === "platform_admin")
  );
}

export function isPlatformAdmin(ctx: AuthorizedContext): boolean {
  return activeMemberships(ctx).some((m) => m.role === "platform_admin");
}

/** Units the user may request passes for. */
export function authorizedUnitIds(ctx: AuthorizedContext): string[] {
  return activeMemberships(ctx)
    .filter((m) => m.role === "resident" && m.unit_id !== null)
    .map((m) => m.unit_id as string);
}

/** Throwing guard used by server actions. */
export function requireAdminOf(ctx: AuthorizedContext, communityId: string): void {
  if (!isAdminOf(ctx, communityId)) {
    throw new PermissionError("You are not an administrator of this community.");
  }
}

export function requirePlatformAdmin(ctx: AuthorizedContext): void {
  if (!isPlatformAdmin(ctx)) {
    throw new PermissionError("Platform administrator access required.");
  }
}

export class PermissionError extends Error {
  readonly code = "FORBIDDEN";
  constructor(message: string) {
    super(message);
    this.name = "PermissionError";
  }
}
