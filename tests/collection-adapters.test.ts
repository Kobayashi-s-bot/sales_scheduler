import { describe, expect, it, vi } from "vitest";
import { HtmlSourceAdapter, RssSourceAdapter, parseRss } from "@/lib/collection/adapters";
import { HostRateLimiter } from "@/lib/collection/rate-limiter";

const config = { url: "https://example.com/feed.xml", type: "rss" as const, refreshIntervalMinutes: 60 };

describe("public source adapters", () => {
  it("parses RSS entries and preserves source and publication date", () => {
    const result = parseRss(`<rss><channel><item><title>展示会</title><link>https://example.com/news/1</link><description><![CDATA[2027年5月1日 開催]]></description><pubDate>Mon, 01 Mar 2027 00:00:00 GMT</pubDate></item></channel></rss>`);
    expect(result).toEqual([{ url: "https://example.com/news/1", title: "展示会", content: "2027年5月1日 開催", publishedAt: "2027-03-01T00:00:00.000Z" }]);
  });

  it("keeps an RSS item when publication date is missing", () => {
    expect(parseRss(`<item><title>周年</title><link>https://example.com/a</link><description>告知</description></item>`)[0].publishedAt).toBeNull();
  });

  it("reports an HTML fetch failure", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response("User-agent: *", { status: 200 })).mockResolvedValueOnce(new Response("no", { status: 503 }));
    await expect(new HtmlSourceAdapter(fetcher, new HostRateLimiter(0)).fetch({ ...config, type: "html" })).rejects.toThrow("503");
  });

  it("honors robots.txt", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response("User-agent: *\nDisallow: /feed.xml", { status: 200 }));
    await expect(new RssSourceAdapter(fetcher, new HostRateLimiter(0)).fetch(config)).rejects.toThrow("robots.txt");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rate limits repeated requests to the same host", async () => {
    let now = 1_000;
    const limiter = new HostRateLimiter(1_000, () => now);
    limiter.claim(config.url);
    expect(() => limiter.claim(config.url)).toThrow("rate limit");
    now += 1_000;
    expect(() => limiter.claim(config.url)).not.toThrow();
  });
});
