import fs from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PublicSourcesPanel } from "@/components/public-sources-panel";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const sources = [
  { id: "source-1", source_url: "https://example.com/feed", source_type: "rss" as const, last_checked_at: null, last_error: "Fetch failed" },
  { id: "source-2", source_url: "https://example.com/news", source_type: "html" as const, last_checked_at: "2026-11-12T00:00:00Z", last_error: null },
];

const render = (list: typeof sources) => renderToStaticMarkup(<PublicSourcesPanel organizationId="org-1" companyId="company-1" sources={list} />);
const panelSource = fs.readFileSync("src/components/public-sources-panel.tsx", "utf8");

describe("PublicSourcesPanel (static markup)", () => {
  it("shows the heading and an empty state with no sources", () => {
    const html = render([]);
    expect(html).toContain("取得元");
    expect(html).toContain("取得元はありません");
    expect(html).not.toContain("削除");
  });

  it("lists sources with type, last checked and last error", () => {
    const html = render(sources);
    expect(html).toContain("https://example.com/feed");
    expect(html).toContain("https://example.com/news");
    expect(html).toContain("未取得");
    expect(html).toContain("Fetch failed");
    expect(html).toContain("2026-11-12T00:00:00Z");
    expect((html.match(/削除/g) ?? []).length).toBe(2);
  });

  it("offers the add form with a rss/html type select", () => {
    const html = render([]);
    expect(html).toContain('name="sourceUrl"');
    expect(html).toContain('name="sourceType"');
    expect(html).toMatch(/<option value="rss"[^>]*>rss<\/option>/);
    expect(html).toMatch(/<option value="html"[^>]*>html<\/option>/);
  });

  it("gives every button a primary or secondary button class", () => {
    const all = panelSource.match(/<button\b/g) ?? [];
    const styled = panelSource.match(/<button className="(?:primary|secondary)-button/g) ?? [];
    expect(all.length).toBeGreaterThan(0);
    expect(styled.length).toBe(all.length);
  });
});

describe("PublicSourcesPanel delete confirmation (AC17, source inspection)", () => {
  const deleteBody = panelSource.slice(panelSource.indexOf("async function deleteSource"));

  it("asks for confirmation before any DELETE request", () => {
    const confirmAt = deleteBody.indexOf("window.confirm(");
    const fetchAt = deleteBody.indexOf("fetch(");
    expect(confirmAt).toBeGreaterThan(-1);
    expect(fetchAt).toBeGreaterThan(confirmAt);
    expect(deleteBody.slice(confirmAt, fetchAt)).toMatch(/\)\s*\)\s*return;/);
  });

  it("states what is lost and what is kept", () => {
    expect(panelSource).toContain("この取得元から取り込んだ記事の記録は消えます。採用前の候補は残ります。");
  });

  it("sends the organization, company and id for DELETE and never calls collection code", () => {
    expect(deleteBody).toContain('method: "DELETE"');
    expect(deleteBody).toContain("organizationId=");
    expect(deleteBody).toContain("companyId=");
    expect(panelSource).not.toContain("collection/run");
    expect(panelSource).not.toContain("supabase/admin");
  });

  it("derives the initial type from the URL unless chosen by hand", () => {
    expect(panelSource).toContain("suggestSourceType(nextUrl)");
    expect(panelSource).toMatch(/if \(!manuallySelected\) setSourceType\(/);
    expect(panelSource).toMatch(/setManuallySelected\(true\)/);
  });
});
