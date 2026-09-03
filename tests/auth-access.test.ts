import { describe, expect, it } from "vitest";
import { AccessDeniedError, authorizeOrganization, requireAuthenticatedUser } from "@/lib/auth/access";

describe("server-side authorization", () => {
  it("rejects unauthenticated access", () => { expect(() => requireAuthenticatedUser(null)).toThrowError(new AccessDeniedError("Authentication required")); });
  it("allows a member", () => { expect(authorizeOrganization({ id: "user-a" }, "org-a", [{ organization_id: "org-a", user_id: "user-a", role: "member" }]).organization_id).toBe("org-a"); });
  it("rejects cross-organization IDOR", () => { expect(() => authorizeOrganization({ id: "user-a" }, "org-b", [{ organization_id: "org-a", user_id: "user-a", role: "owner" }])).toThrowError(AccessDeniedError); });
});
