import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve("supabase/migrations/20260909000000_event_candidates.sql"), "utf8").toLowerCase();

describe("event candidates migration security", () => {
  it("enables member-scoped RLS and denies anon table access", () => {
    expect(sql).toContain("alter table public.event_candidates enable row level security");
    expect(sql).toContain("public.is_organization_member(organization_id)");
    expect(sql).toContain("revoke all on public.event_candidates from anon");
  });
  it("restricts the acceptance function execution", () => {
    expect(sql).toContain("security invoker");
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain("from public");
    expect(sql).toContain("from anon");
    expect(sql).toContain("to authenticated");
  });
  it("validates candidate fields and prevents duplicate candidates", () => {
    expect(sql).toMatch(/status text not null default 'pending' check \(status in \('pending', 'accepted', 'rejected'\)\)/);
    expect(sql).toContain("confidence between 0 and 1");
    expect(sql).toContain("source_url ~ '^https://'");
    expect(sql).toContain("unique nulls not distinct");
  });
});
