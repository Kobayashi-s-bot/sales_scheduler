import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve("supabase/migrations/20260903000000_foundation.sql"), "utf8").toLowerCase();
const timingSql = readFileSync(resolve("supabase/migrations/20260904000000_sales_timing_engine.sql"), "utf8").toLowerCase();
const tenantTables = ["organizations", "organization_members", "companies", "contacts", "sales_history", "events", "sales_opportunities", "scoring_rules"];
describe("RLS migration contract", () => {
  it.each(tenantTables)("enables RLS on %s", (table) => { expect(sql).toContain(`alter table public.${table} enable row level security`); });
  it.each(["companies", "contacts", "sales_history", "events", "sales_opportunities", "scoring_rules"])("enforces membership on %s", (table) => { expect(sql).toMatch(new RegExp(`create policy ${table}_[\\s\\S]*?is_organization_member\\(organization_id\\)`)); });
  it("uses invoker security for analysis view", () => { expect(sql).toContain("with (security_invoker = true)"); });
  it("denies anonymous table access", () => { expect(sql).toContain("revoke all on all tables in schema public from anon"); });
  it("reserves owner role management for owners", () => {
    expect(sql).toContain("is_organization_owner(organization_id)");
    expect(sql).toContain("is_organization_admin(organization_id) and role <> 'owner'");
  });
  it("protects the final owner with a database trigger", () => {
    expect(sql).toContain("create trigger organization_members_protect_last_owner");
    expect(sql).toContain("organization must retain at least one owner");
  });
});

describe("sales recommendation migration contract", () => {
  it("enables RLS and organization membership policy", () => {
    expect(timingSql).toContain("alter table public.sales_recommendations enable row level security");
    expect(timingSql).toContain("public.is_organization_member(organization_id)");
  });
  it("keeps recommendation evidence separate from contacts", () => {
    expect(timingSql).not.toContain("contact_id");
    expect(timingSql).not.toContain("references public.contacts");
  });
  it("rejects duplicate events and cross-organization sources", () => {
    expect(timingSql).toContain("unique nulls not distinct");
    expect(timingSql).toContain("event does not belong to company and organization");
    expect(timingSql).toContain("using errcode = '23514'");
  });
  it("limits timing-rule writes to organization admins", () => {
    expect(timingSql).toContain("drop policy scoring_rules_member_all");
    expect(timingSql).toContain("create policy scoring_rules_update_admin");
    expect(timingSql).toContain("public.is_organization_admin(organization_id)");
  });
});
