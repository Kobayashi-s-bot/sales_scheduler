import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { publicSourceInputSchema } from "@/lib/validation/public-source";
import { suggestSourceType } from "@/lib/validation/public-source-type";

describe("public source validation", () => {
  it("accepts valid https RSS and HTML sources", () => {
    expect(publicSourceInputSchema.safeParse({ companyId: "00000000-0000-4000-8000-000000000001", sourceUrl: "https://example.com/feed.xml", sourceType: "rss" }).success).toBe(true);
    expect(publicSourceInputSchema.safeParse({ companyId: "00000000-0000-4000-8000-000000000001", sourceUrl: "https://example.com/news", sourceType: "html" }).success).toBe(true);
  });
  it("rejects unsafe URLs, invalid types, ids and server-controlled fields", () => {
    for (const sourceUrl of ["http://example.com/", "ftp://example.com/", "", `https://${"a".repeat(2043)}`, "https://127.0.0.1/", "https://10.0.0.1/", "https://192.168.1.1/", "https://169.254.169.254/", "https://localhost/"]) expect(publicSourceInputSchema.safeParse({ companyId: "00000000-0000-4000-8000-000000000001", sourceUrl, sourceType: "rss" }).success).toBe(false);
    for (const sourceType of ["atom", "", undefined]) expect(publicSourceInputSchema.safeParse({ companyId: "00000000-0000-4000-8000-000000000001", sourceUrl: "https://example.com", sourceType }).success).toBe(false);
    expect(publicSourceInputSchema.safeParse({ companyId: "bad", sourceUrl: "https://example.com", sourceType: "rss" }).success).toBe(false);
    expect(publicSourceInputSchema.safeParse({ companyId: "00000000-0000-4000-8000-000000000001", sourceUrl: "https://example.com", sourceType: "rss", organizationId: "x" }).success).toBe(false);
  });
  it("accepts a 2048-character URL and rejects 2049 characters (AC2 boundary)", () => {
    const ID = "00000000-0000-4000-8000-000000000001";
    const prefix = "https://example.com/";
    const at2048 = prefix + "a".repeat(2048 - prefix.length);
    const at2049 = prefix + "a".repeat(2049 - prefix.length);
    expect(at2048.length).toBe(2048);
    expect(at2049.length).toBe(2049);
    expect(publicSourceInputSchema.safeParse({ companyId: ID, sourceUrl: at2048, sourceType: "html" }).success).toBe(true);
    expect(publicSourceInputSchema.safeParse({ companyId: ID, sourceUrl: at2049, sourceType: "html" }).success).toBe(false);
  });
  it("rejects every server-controlled key and never outputs one (AC4)", () => {
    const base = { companyId: "00000000-0000-4000-8000-000000000001", sourceUrl: "https://example.com/feed", sourceType: "rss" };
    for (const extra of [{ organizationId: "x" }, { refreshIntervalMinutes: 5 }, { nextCheckAt: "2020-01-01" }, { failureCount: 0 }]) {
      expect(publicSourceInputSchema.safeParse({ ...base, ...extra }).success).toBe(false);
    }
    const parsed = publicSourceInputSchema.parse(base);
    expect(Object.keys(parsed).sort()).toEqual(["companyId", "sourceType", "sourceUrl"]);
  });
  it("keeps the browser-side helper free of Node-only imports (build regression)", () => {
    const helper = fs.readFileSync("src/lib/validation/public-source-type.ts", "utf8");
    expect(helper).not.toMatch(/^\s*import\b/m);
    const panel = fs.readFileSync("src/components/public-sources-panel.tsx", "utf8");
    expect(panel).not.toContain("@/lib/validation/public-source\"");
    expect(panel).not.toContain("@/lib/collection/");
  });
  it("suggests a source type without throwing", () => {
    expect(suggestSourceType("https://github.blog/feed/")).toBe("rss");
    expect(suggestSourceType("https://example.com/a.xml")).toBe("rss");
    expect(suggestSourceType("https://example.com/rss")).toBe("rss");
    expect(suggestSourceType("https://example.com/news")).toBe("html");
    expect(suggestSourceType("nonsense")).toBe("html");
  });
});
