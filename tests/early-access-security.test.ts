import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const read = (path: string) => readFileSync(resolve(path), "utf8");
describe("early access security boundaries", () => {
  it.each(["src/app/api/companies/[companyId]/route.ts", "src/app/api/contacts/route.ts", "src/app/api/contacts/[contactId]/route.ts", "src/app/api/sales-history/route.ts"])("requires organization membership in %s", (path) => { const source = read(path); expect(source).toContain("requireOrganizationMembership"); expect(source).toContain("organizationId"); });
  it("scopes contact edits by organization, company and contact", () => { const source = read("src/app/api/contacts/[contactId]/route.ts"); expect(source).toContain('.eq("organization_id", input.organizationId)'); expect(source).toContain('.eq("company_id", input.companyId)'); expect(source).toContain('.eq("id", input.contactId)'); });
  it("does not expose service role code to client components", () => { const clients = ["src/components/auth-form.tsx", "src/components/app-shell.tsx", "src/components/data-forms.tsx"].map(read).join("\n"); expect(clients).not.toMatch(/service.role|SUPABASE_SERVICE_ROLE_KEY/i); });
  it("redirects unauthenticated page requests without redirecting APIs", () => { const source = read("proxy.ts"); expect(source).toContain("protectedPage && !user"); expect(source).not.toContain('"/api"'); });
  it("keeps Proxy as an optimistic check while pages use the server DAL", () => { for (const path of ["src/app/dashboard/page.tsx", "src/app/companies/page.tsx", "src/app/companies/[companyId]/page.tsx", "src/app/calendar/page.tsx"]) expect(read(path)).toContain("requireOrganizationContext"); });
});
