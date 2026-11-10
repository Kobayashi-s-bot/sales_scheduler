import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  MAX_SOURCES_PER_RUN,
  TIME_BUDGET_MS,
  runScheduledCollection,
} from "@/lib/collection/scheduled";

function setup(rows: unknown[]) {
  const order = vi.fn();
  const limit = vi.fn();
  const query = { select: vi.fn(), or: vi.fn(), order, limit } as Record<string, unknown>;
  for (const method of [query.select, query.or, order]) (method as ReturnType<typeof vi.fn>).mockReturnValue(query);
  limit.mockResolvedValue({ data: rows, error: null });
  const from = vi.fn(() => query);
  const collect = vi.fn(async ({ analyzer }: { analyzer: { analyze: (document: unknown) => Promise<unknown[]> } }) => {
    const events = await analyzer.analyze({});
    return { documents: 1, analyzed: 1, extractedEvents: events.length };
  });
  return { from, collect, query, order, limit };
}

const row = (id: string, next_check_at: string | null, source_url = `https://${id}.example/feed`) => ({
  id,
  organization_id: `org-${id}`,
  company_id: `company-${id}`,
  source_url,
  source_type: "rss",
  refresh_interval_minutes: 60,
  next_check_at,
});

const run = (deps: ReturnType<typeof setup>, options: { now?: () => Date; sleep?: (ms: number) => Promise<void>; analyzer?: { analyze: ReturnType<typeof vi.fn> } } = {}) => runScheduledCollection({
  supabase: { from: deps.from } as never,
  collect: deps.collect as never,
  createAdapter: () => ({ fetch: vi.fn() }) as never,
  analyzer: (options.analyzer ?? { analyze: vi.fn(async () => [{}, {}, {}]) }) as never,
  now: options.now ?? (() => new Date("2026-01-01T00:00:00Z")),
  sleep: options.sleep ?? vi.fn(async () => undefined),
});

describe("runScheduledCollection", () => {
  it("queries due rows in null-first order and passes selected source values unchanged", async () => {
    const deps = setup([row("null", null), row("old", "2025-12-31T00:00:00Z"), row("equal", "2026-01-01T00:00:00Z")]);
    const result = await run(deps);
    expect(deps.query.or).toHaveBeenCalledWith("next_check_at.is.null,next_check_at.lte.2026-01-01T00:00:00.000Z");
    expect(deps.order).toHaveBeenCalledWith("next_check_at", { ascending: true, nullsFirst: true });
    expect(deps.limit).toHaveBeenCalledWith(MAX_SOURCES_PER_RUN);
    expect(deps.collect).toHaveBeenCalledTimes(3);
    for (const [index, id] of ["null", "old", "equal"].entries()) {
      expect(deps.collect).toHaveBeenNthCalledWith(index + 1, expect.objectContaining({
        organizationId: `org-${id}`,
        companyId: `company-${id}`,
        config: { url: `https://${id}.example/feed`, type: "rss", refreshIntervalMinutes: 60 },
      }));
    }
    expect(result).toMatchObject({ selected: 3, extractedEvents: 9 });
  });

  it("continues after a failure, retries once, and counts analyzer output", async () => {
    const deps = setup([row("one", null), row("two", null), row("three", null)]);
    deps.collect.mockRejectedValueOnce(new Error("first attempt"));
    const result = await run(deps);
    expect(deps.collect).toHaveBeenCalledTimes(4);
    expect(result).toMatchObject({ succeeded: 3, failed: 0, documents: 3, analyzedDocuments: 3, extractedEvents: 9 });
  });

  it("stops for the time budget without collecting the next selected row", async () => {
    const deps = setup([row("one", null), row("two", null)]);
    let clock = 0;
    deps.collect.mockImplementation(async () => { clock = TIME_BUDGET_MS; return { documents: 1, analyzed: 1, extractedEvents: 0 }; });
    const result = await run(deps, { now: () => new Date(clock) });
    expect(deps.collect).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ stoppedBy: "time", skipped: 1 });
  });

  it("applies the source limit and does not collect rows beyond the query limit", async () => {
    const deps = setup(Array.from({ length: MAX_SOURCES_PER_RUN }, (_, i) => row(String(i), null)));
    const result = await run(deps);
    expect(deps.limit).toHaveBeenCalledWith(MAX_SOURCES_PER_RUN);
    expect(deps.collect).toHaveBeenCalledTimes(MAX_SOURCES_PER_RUN);
    expect(result).toMatchObject({ stoppedBy: "limit", selected: MAX_SOURCES_PER_RUN });
  });

  it("waits at least 1100ms between same-host sources but not different hosts", async () => {
    const deps = setup([row("a", null, "https://same.example/a"), row("b", null, "https://same.example/b"), row("c", null, "https://other.example/c")]);
    let clock = 0;
    const sleeps: number[] = [];
    deps.collect.mockImplementation(async () => { clock += 10; return { documents: 1, analyzed: 1, extractedEvents: 0 }; });
    await run(deps, { now: () => new Date(clock), sleep: async (ms) => { sleeps.push(ms); clock += ms; } });
    expect(sleeps.length).toBe(1);
    expect(sleeps[0]).toBeGreaterThanOrEqual(1100);
  });

  it("counts a persistent retry failure only once", async () => {
    const deps = setup([row("one", null)]);
    deps.collect.mockRejectedValue(new Error("failure"));
    const result = await run(deps);
    expect(deps.collect).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ succeeded: 0, failed: 1 });
  });

  it("keeps going when the second of three sources keeps failing (AC6)", async () => {
    const deps = setup([row("one", null), row("two", null), row("three", null)]);
    const base = deps.collect.getMockImplementation() as (args: unknown) => Promise<unknown>;
    deps.collect.mockImplementation((async (args: { organizationId: string }) => {
      if (args.organizationId === "org-two") throw new Error("failure");
      return base(args);
    }) as never);
    const result = await run(deps);
    expect(deps.collect).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "org-three" }));
    expect(result).toMatchObject({ succeeded: 2, failed: 1 });
  });

  it("counts a row with an unparsable source URL as failed without stopping the run", async () => {
    const deps = setup([row("bad", null, "https://[invalid"), row("good", null)]);
    const result = await run(deps);
    expect(deps.collect).toHaveBeenCalledTimes(1);
    expect(deps.collect).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "org-good" }));
    expect(result).toMatchObject({ succeeded: 1, failed: 1 });
  });

  it("keeps the same-host interval on the retry pass even when every attempt fails (R12)", async () => {
    const deps = setup([row("a", null, "https://same.example/a"), row("b", null, "https://same.example/b")]);
    let clock = 0;
    const sleeps: number[] = [];
    deps.collect.mockImplementation(async () => { clock += 10; throw new Error("failure"); });
    const result = await run(deps, { now: () => new Date(clock), sleep: async (ms) => { sleeps.push(ms); clock += ms; } });
    expect(deps.collect).toHaveBeenCalledTimes(4);
    expect(sleeps.length).toBe(3);
    for (const slept of sleeps) expect(slept).toBeGreaterThan(0);
    expect(result).toMatchObject({ succeeded: 0, failed: 2 });
  });

  it("does not retry a failure when the time budget is exhausted", async () => {
    const deps = setup([row("one", null)]);
    let clock = 0;
    deps.collect.mockImplementation(async () => { clock = TIME_BUDGET_MS; throw new Error("failure"); });
    const result = await run(deps, { now: () => new Date(clock) });
    expect(deps.collect).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ succeeded: 0, failed: 1, stoppedBy: "time" });
  });
});
