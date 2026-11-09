import { describe, expect, it } from "vitest";
import { assertPublicHttpsUrl } from "@/lib/collection/policy";

describe("collection URL policy", () => {
  it.each(["http://example.com", "https://localhost/a", "https://127.0.0.1/a", "https://10.0.0.1/a", "https://192.168.1.1/a", "https://172.16.0.1/a"])("rejects non-public source %s", (url) => {
    expect(() => assertPublicHttpsUrl(url)).toThrow();
  });
  it("allows a public HTTPS source", () => { expect(assertPublicHttpsUrl("https://prtimes.jp/main/html/searchrlp/company_id/1").protocol).toBe("https:"); });
});
