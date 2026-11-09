import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CandidateCard, CandidateTabs, CandidateList } from "@/components/candidate-review";
import { AppShell } from "@/components/app-shell";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/lib/supabase/browser", () => ({ createSupabaseBrowserClient: () => ({ auth: { signOut: vi.fn() } }) }));

const candidate = {
  id: "c1",
  company_name: "Example",
  event_type: "exhibition",
  title: "Event",
  occurred_on: "2026-12-01",
  confidence: 0.873,
  created_at: "2026-11-08T15:30:00Z",
  published_at: "2026-11-01",
  summary: "Summary",
  source_url: "https://example.com",
};

describe("candidate review UI", () => {
  it("renders candidate details and safe source link", () => {
    const html = renderToStaticMarkup(<CandidateCard candidate={candidate} />);
    for (const value of [
      "Example", "exhibition", "Event", "87%", "2026-11-09", "2026-11-01", "Summary",
      'href="https://example.com/"', 'target="_blank"', "noopener", "noreferrer",
    ]) {
      expect(html).toContain(value);
    }
  });

  it("shows the article publication timestamp as an Asia/Tokyo calendar date (R4)", () => {
    const html = renderToStaticMarkup(
      <CandidateCard candidate={{ ...candidate, published_at: "2026-11-08T15:30:00+00:00" }} />,
    );
    expect(html).toContain("記事公開日</dt><dd>2026-11-09</dd>");
    expect(html).not.toContain("T15:30:00");
  });

  it("renders fallback fields and non-HTTPS source as text (A8)", () => {
    const html = renderToStaticMarkup(
      <CandidateCard
        candidate={{ ...candidate, company_name: null, occurred_on: null, published_at: null, source_url: "http://example.com" }}
      />,
    );
    for (const value of ["企業不明", "日付未定", "http://example.com"]) expect(html).toContain(value);
    expect(html).toContain("記事公開日</dt><dd>不明</dd>");
    expect(html).not.toMatch(/<a\s/);
  });

  it("keeps the unknown publication date distinct from the unknown company", () => {
    const html = renderToStaticMarkup(<CandidateCard candidate={{ ...candidate, published_at: null }} />);
    expect(html).not.toContain("企業不明");
    expect(html).toContain("記事公開日</dt><dd>不明</dd>");
  });

  it("escapes titles and only renders passed actions", () => {
    const html = renderToStaticMarkup(
      <CandidateCard candidate={{ ...candidate, title: "<script>x</script>" }} actions={<button>操作</button>} />,
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("操作");
    expect(renderToStaticMarkup(<CandidateCard candidate={candidate} />)).not.toContain("操作");
  });

  it("renders scoped tabs with only the current tab marked", () => {
    const html = renderToStaticMarkup(<CandidateTabs organizationId="org1" status="accepted" />);
    for (const value of [
      "未確認", "採用済み", "却下", "organizationId=org1",
      "status=pending", "status=accepted", "status=rejected", "tab-active", 'aria-current="page"',
    ]) {
      expect(html).toContain(value);
    }
    expect((html.match(/aria-current="page"/g) ?? []).length).toBe(1);
    expect((html.match(/tab-active/g) ?? []).length).toBe(1);
  });

  it("renders empty state and app navigation", () => {
    expect(renderToStaticMarkup(<CandidateList candidates={[]} />)).toContain("該当する候補はありません");
    const html = renderToStaticMarkup(<AppShell organizationId="org1">body</AppShell>);
    expect((html.match(/href="\/candidates\?organizationId=org1"/g) ?? []).length).toBe(2);
    expect(html).toContain("grid-cols-4");
    for (const value of [
      "/dashboard?organizationId=org1", "/companies?organizationId=org1", "/calendar?organizationId=org1",
      "営業対象", "企業", "カレンダー",
    ]) {
      expect(html).toContain(value);
    }
  });

  it("keeps protected route and required boundary strings out", async () => {
    const fs = await import("node:fs");
    const proxy = fs.readFileSync("proxy.ts", "utf8");
    expect(proxy).toContain("/candidates");
    expect(proxy).toContain("protectedPage && !user");
    expect(proxy).not.toContain("/api");
    const forbidden = [/contacts/, /service[._-]?role/i, /SUPABASE_SERVICE_ROLE_KEY/, /dangerouslySetInnerHTML/];
    for (const path of [
      "src/lib/candidates/review.ts",
      "src/components/candidate-review.tsx",
      "src/components/candidate-actions.tsx",
      "src/app/candidates/page.tsx",
    ]) {
      const body = fs.readFileSync(path, "utf8");
      for (const pattern of forbidden) expect(body).not.toMatch(pattern);
    }
  });

  it("gives every action button a primary or secondary button class (A15)", async () => {
    const fs = await import("node:fs");
    const body = fs.readFileSync("src/components/candidate-actions.tsx", "utf8");
    const all = body.match(/<button\b/g) ?? [];
    const styled = body.match(/<button className="(?:primary|secondary)-button"/g) ?? [];
    expect(all.length).toBeGreaterThan(0);
    expect(styled.length).toBe(all.length);
  });
});
