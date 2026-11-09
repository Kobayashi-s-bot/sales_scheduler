import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { collectPublicSource } from "@/lib/collection/service";

const { from, analyze } = vi.hoisted(() => ({ from: vi.fn(), analyze: vi.fn() }));

function query(data: unknown) {
  const q: Record<string, unknown> = {};
  for (const method of ["upsert", "select", "single", "eq", "maybeSingle", "insert", "update"]) {
    q[method] = vi.fn(() => q);
  }
  q.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve);
  return q;
}

describe("collectPublicSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const source = query({ id: "source-1", failure_count: 0 });
    const documentLookup = query(null);
    const documentSave = query({ id: "document-1" });
    const candidateSave = query(null);
    const sourceUpdate = query(null);
    from.mockImplementation((table: string) => {
      if (table === "public_sources") return from.mock.calls.filter(([name]) => name === table).length === 1 ? source : sourceUpdate;
      if (table === "source_documents") return from.mock.calls.filter(([name]) => name === table).length === 1 ? documentLookup : documentSave;
      if (table === "event_candidates") return candidateSave;
      throw new Error(`unexpected table ${table}`);
    });
    analyze.mockResolvedValue([{ eventType: "funding", eventDate: "2026-01-02", title: "Funding", summary: "Raised", confidence: 0.9 }]);
  });

  it("upserts extracted candidates with deduplication and never writes events", async () => {
    const supabase = { from } as never;
    await collectPublicSource({
      supabase,
      organizationId: "org-1",
      companyId: "company-1",
      config: { url: "https://example.com/feed", type: "rss", refreshIntervalMinutes: 60 },
      adapter: { type: "rss", fetch: vi.fn().mockResolvedValue([{ url: "https://example.com/story", title: "Story", content: "body", publishedAt: null }]) },
      analyzer: { analyze },
      now: new Date("2026-01-01T00:00:00Z"),
    });

    const candidateQuery = from.mock.results.find((_, index) => from.mock.calls[index][0] === "event_candidates")?.value;
    expect(candidateQuery.upsert).toHaveBeenCalledWith(expect.objectContaining({ event_type: "funding" }), {
      onConflict: "organization_id,company_id,event_type,occurred_on,title,source_url",
      ignoreDuplicates: true,
    });
    expect(from.mock.calls.some(([table]) => table === "events")).toBe(false);
  });

  it("does not analyze an unchanged document content hash", async () => {
    const { contentHash } = await import("@/lib/collection/freshness");
    const matchingHash = await contentHash("unchanged");
    const source = query({ id: "source-1", failure_count: 0 });
    const existingDocument = query({ id: "document-existing", content_hash: "same", fetched_at: "2025-12-01T00:00:00Z" });
    const documentUpdate = query({ id: "document-existing" });
    from.mockImplementation((table: string) => {
      if (table === "public_sources") return from.mock.calls.filter(([name]) => name === table).length === 1 ? source : query(null);
      if (table === "source_documents") return from.mock.calls.filter(([name]) => name === table).length === 1 ? existingDocument : documentUpdate;
      return query(null);
    });
    const adapter = { type: "rss" as const, fetch: vi.fn().mockResolvedValue([{ url: "https://example.com/story", title: "Story", content: "unchanged", publishedAt: null }]) };
    existingDocument.maybeSingle = vi.fn(async () => ({ data: { id: "document-existing", content_hash: matchingHash, fetched_at: "2025-12-01T00:00:00Z" }, error: null }));
    await collectPublicSource({
      supabase: { from } as never,
      organizationId: "org-1",
      companyId: "company-1",
      config: { url: "https://example.com/feed", type: "rss", refreshIntervalMinutes: 60 },
      adapter,
      analyzer: { analyze },
      now: new Date("2026-01-01T00:00:00Z"),
    });
    expect(analyze).not.toHaveBeenCalled();
  });
});
