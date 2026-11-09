import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve("supabase/migrations/20260908000000_public_information_collection.sql"), "utf8").toLowerCase();
describe("collection migration security", () => {
  it("enables organization-scoped RLS for collection tables", () => {
    expect(sql).toContain("alter table public.public_sources enable row level security");
    expect(sql).toContain("alter table public.source_documents enable row level security");
    expect(sql).toContain("public.is_organization_member(organization_id)");
  });
  it("stores freshness, retry and update metadata", () => {
    for (const field of ["published_at", "fetched_at", "last_checked_at", "next_check_at", "content_hash", "failure_count"]) expect(sql).toContain(field);
  });
  it("deduplicates source documents and extracted events", () => {
    expect(sql).toContain("unique (organization_id, company_id, source_url)");
    expect(sql).toContain("(organization_id, company_id, event_type, occurred_on, title, source_url, source_document_id)");
  });
  it("does not reference contacts", () => { expect(sql).not.toContain("public.contacts"); });
});
