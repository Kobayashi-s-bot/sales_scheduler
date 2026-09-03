import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve("supabase/migrations/20260903000000_foundation.sql"), "utf8").toLowerCase();
const tenantTables = ["organizations", "organization_members", "companies", "contacts", "sales_history", "events", "sales_opportunities", "scoring_rules"];
describe("RLS migration contract", () => {
  it.each(tenantTables)("enables RLS on %s", (table) => { expect(sql).toContain(`alter table public.${table} enable row level security`); });
  it.each(["companies", "contacts", "sales_history", "events", "sales_opportunities", "scoring_rules"])("enforces membership on %s", (table) => { expect(sql).toMatch(new RegExp(`create policy ${table}_[\\s\\S]*?is_organization_member\\(organization_id\\)`)); });
  it("uses invoker security for analysis view", () => { expect(sql).toContain("with (security_invoker = true)"); });
  it("denies anonymous table access", () => { expect(sql).toContain("revoke all on all tables in schema public from anon"); });
});
