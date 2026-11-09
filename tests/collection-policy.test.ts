import { describe, expect, it } from "vitest";
import { assertPublicHostResolves, assertPublicHttpsUrl, isPathAllowedByRobots } from "@/lib/collection/policy";

describe("collection URL policy", () => {
  it.each(["http://example.com", "https://localhost/a", "https://127.0.0.1/a", "https://10.0.0.1/a", "https://192.168.1.1/a", "https://172.16.0.1/a"])("rejects non-public source %s", (url) => {
    expect(() => assertPublicHttpsUrl(url)).toThrow();
  });
  it("allows a public HTTPS source", () => { expect(assertPublicHttpsUrl("https://prtimes.jp/main/html/searchrlp/company_id/1").protocol).toBe("https:"); });

  it.each([
    ["private IPv4", [{ address: "10.0.0.1", family: 4 }]],
    ["mixed addresses", [{ address: "8.8.8.8", family: 4 }, { address: "192.168.1.1", family: 4 }]],
    ["mapped private IPv6", [{ address: "::ffff:10.0.0.1", family: 6 }]],
  ])("rejects %s DNS answers", async (_name, answers) => {
    await expect(assertPublicHostResolves("https://example.com", async () => answers)).rejects.toThrow();
  });
  it("allows a public DNS answer", async () => {
    await expect(assertPublicHostResolves("https://example.com", async () => [{ address: "8.8.8.8", family: 4 }])).resolves.toBeUndefined();
  });
  it("rejects empty and failed DNS resolution", async () => {
    await expect(assertPublicHostResolves("https://example.com", async () => [])).rejects.toThrow();
    await expect(assertPublicHostResolves("https://example.com", async () => { throw new Error("DNS failed"); })).rejects.toThrow();
  });
  it("uses the most specific Allow or Disallow rule, with Allow winning ties", () => {
    const rules = "User-agent: *\nDisallow: /foo\nAllow: /foo/bar\nDisallow: /equal\nAllow: /equal";
    expect(isPathAllowedByRobots(rules, "https://example.com/foo/bar")).toBe(true);
    expect(isPathAllowedByRobots(rules, "https://example.com/foo/x")).toBe(false);
    expect(isPathAllowedByRobots(rules, "https://example.com/equal")).toBe(true);
  });
  it("supports robots wildcards, end anchors, group specificity, and empty Disallow", () => {
    const rules = "User-agent: *\nDisallow: /\n\nUser-agent: OtherBot\nDisallow: /\n\nUser-agent: SalesSchedulerBot\nDisallow: /private/*\nAllow: /private/open$\nDisallow:";
    expect(isPathAllowedByRobots(rules, "https://example.com/private/open")).toBe(true);
    expect(isPathAllowedByRobots(rules, "https://example.com/private/open/child")).toBe(false);
    expect(isPathAllowedByRobots(rules, "https://example.com/public")).toBe(true);
  });
});
