import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const admin = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: admin }));
vi.mock("@/lib/collection/adapters", () => ({
  RssSourceAdapter: class { fetch() { return Promise.resolve([]); } },
  HtmlSourceAdapter: class { fetch() { return Promise.resolve([]); } },
}));
vi.mock("@/lib/collection/analyzer", () => ({ HeuristicEventAnalyzer: class {} }));
vi.mock("@/lib/collection/service", () => ({ collectPublicSource: vi.fn() }));

import { GET } from "@/app/api/cron/collect/route";
import { collectPublicSource } from "@/lib/collection/service";

describe("cron collection route", () => {
  it("rejects without creating an admin client or exposing supplied values", async () => {
    const original = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "local-test-value-long-enough-to-be-valid";
    const spies = (["error", "log", "warn"] as const).map((name) => vi.spyOn(console, name).mockImplementation(() => undefined));
    const response = await GET(new Request("https://local.example/api/cron/collect", {
      headers: { authorization: "Bearer local-test-value-long-enough-to-be-validx" },
    }));
    const body = await response.text();
    expect(response.status).toBe(401);
    expect(body).toBe("{\"error\":\"Unauthorized\"}");
    expect(body).not.toContain("local-test-value");
    expect(body).not.toContain("Bearer");
    for (const spy of spies) expect(spy.mock.calls.flat().join(" ")).not.toContain("local-test-value");
    expect(admin).not.toHaveBeenCalled();
    for (const spy of spies) spy.mockRestore();
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  });
});

const VALID_SECRET = "local-test-value-long-enough-to-be-valid";
const authorizedRequest = () => new Request("https://local.example/api/cron/collect", {
  headers: { authorization: `Bearer ${VALID_SECRET}` },
});

function clientWith(result: { data: unknown; error: unknown }) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "or", "order"]) query[method] = vi.fn(() => query);
  query.limit = vi.fn(async () => result);
  return { from: vi.fn(() => query) };
}

describe("cron collection route responses", () => {
  const original = process.env.CRON_SECRET;
  beforeEach(() => {
    admin.mockReset();
    vi.mocked(collectPublicSource).mockReset();
    process.env.CRON_SECRET = VALID_SECRET;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  });

  it("returns only numeric counters and a stoppedBy value without leaking errors (AC11)", async () => {
    const source = {
      organization_id: "org-secret-id",
      company_id: "company-secret-id",
      source_url: "https://x.example/feed",
      source_type: "rss",
      refresh_interval_minutes: 60,
      next_check_at: null,
    };
    admin.mockReturnValue(clientWith({ data: [source], error: null }));
    vi.mocked(collectPublicSource).mockRejectedValue(new Error("https://x.example/a user@example.com"));
    const response = await GET(authorizedRequest());
    const text = await response.text();
    expect(response.status).toBe(200);
    const body = JSON.parse(text) as { data: Record<string, unknown> };
    expect(Object.keys(body)).toEqual(["data"]);
    expect(Object.keys(body.data).sort()).toEqual(
      ["analyzedDocuments", "documents", "extractedEvents", "failed", "selected", "skipped", "stoppedBy", "succeeded"],
    );
    for (const [key, value] of Object.entries(body.data)) {
      if (key === "stoppedBy") expect(["none", "limit", "time"]).toContain(value);
      else expect(typeof value).toBe("number");
    }
    for (const leaked of ["x.example", "user@example.com", "org-secret-id", "company-secret-id", VALID_SECRET]) {
      expect(text).not.toContain(leaked);
    }
  });

  it("returns a fixed 500 when the source list cannot be read (AC12)", async () => {
    admin.mockReturnValue(clientWith({ data: null, error: new Error("relation public_sources detail") }));
    const response = await GET(authorizedRequest());
    expect(response.status).toBe(500);
    expect(await response.text()).toBe("{\"error\":\"Internal server error\"}");
  });

  it("returns a fixed 500 when the privileged environment is invalid (AC12)", async () => {
    admin.mockImplementation(() => { throw new Error("SUPABASE_SERVICE_ROLE_KEY is invalid"); });
    const response = await GET(authorizedRequest());
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).toBe("{\"error\":\"Internal server error\"}");
    expect(text).not.toContain("SUPABASE");
  });
});

it("imports the privileged client only from the cron route (AC10)", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const importers: string[] = [];
  const walk = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry.name) && fs.readFileSync(full, "utf8").includes("supabase/admin")) {
        importers.push(full.split(path.sep).join("/"));
      }
    }
  };
  walk("src/app");
  expect(importers).toEqual(["src/app/api/cron/collect/route.ts"]);
});

it("keeps the collection table boundary in scheduled and route sources", async () => {
  const fs = await import("node:fs");
  const paths = [
    "src/lib/collection/scheduled.ts",
    "src/lib/collection/cron-auth.ts",
    "src/app/api/cron/collect/route.ts",
    "src/lib/collection/service.ts",
  ];
  for (const path of paths) {
    const text = fs.readFileSync(path, "utf8");
    expect(text).not.toContain("contacts");
    const tables = [...text.matchAll(/\.from\([\"']([^\"']+)[\"']\)/g)].map((match) => match[1]);
    expect(tables.every((table) => ["public_sources", "source_documents", "event_candidates"].includes(table))).toBe(true);
  }
});
