import { assertPublicHostResolves, assertPublicHttpsUrl, isPathAllowedByRobots, robotsUrl } from "@/lib/collection/policy";
import { HostRateLimiter } from "@/lib/collection/rate-limiter";
import type { PublicDocument, SourceAdapter, SourceConfig } from "@/lib/collection/types";

type FetchLike = typeof fetch;
const sharedRateLimiter = new HostRateLimiter();
const MAX_BODY_BYTES = 2 * 1024 * 1024;

function decodeXml(value: string) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

function tag(block: string, names: string[]) {
  for (const name of names) {
    const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
    if (match) return decodeXml(match[1]);
  }
  return null;
}

export function parseRss(xml: string): PublicDocument[] {
  const blocks = xml.match(/<(?:item|entry)(?:\s[^>]*)?>[\s\S]*?<\/(?:item|entry)>/gi) ?? [];
  return blocks.flatMap((block) => {
    const title = tag(block, ["title"]);
    const content = tag(block, ["content:encoded", "content", "description", "summary"]);
    const href = block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1] ?? tag(block, ["link", "guid"]);
    if (!title || !content || !href) return [];
    try {
      const url = assertPublicHttpsUrl(href).toString();
      const rawDate = tag(block, ["pubDate", "published", "updated"]);
      const parsed = rawDate ? Date.parse(rawDate) : Number.NaN;
      return [{ url, title, content, publishedAt: Number.isNaN(parsed) ? null : new Date(parsed).toISOString() }];
    } catch { return []; }
  });
}

abstract class HttpAdapter {
  constructor(protected readonly fetcher: FetchLike = fetch, protected readonly limiter = sharedRateLimiter) {}

  private async readBody(response: Response) {
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) throw new Error("Source response exceeds 2 MiB limit");
    if (!response.body) return "";
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) { await reader.cancel(); throw new Error("Source response exceeds 2 MiB limit"); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return new TextDecoder().decode(bytes);
  }

  protected async get(config: SourceConfig, signal?: AbortSignal) {
    const source = assertPublicHttpsUrl(config.url).toString();
    this.limiter.claim(source);
    const requestSignal = signal ?? AbortSignal.timeout(15_000);
    await assertPublicHostResolves(source);
    const robots = await this.fetcher(robotsUrl(source), { headers: { "user-agent": "SalesSchedulerBot/0.1" }, redirect: "error", signal: requestSignal });
    if (robots.status >= 500) throw new Error(`robots.txt unavailable (${robots.status})`);
    if (robots.status >= 200 && robots.status < 300 && !isPathAllowedByRobots(await this.readBody(robots), source)) throw new Error("Source disallowed by robots.txt");
    await assertPublicHostResolves(source);
    const response = await this.fetcher(source, { headers: { "user-agent": "SalesSchedulerBot/0.1" }, redirect: "error", signal: requestSignal });
    if (!response.ok) throw new Error(`Source fetch failed (${response.status})`);
    return this.readBody(response);
  }
}

export class RssSourceAdapter extends HttpAdapter implements SourceAdapter {
  readonly type = "rss" as const;
  async fetch(config: SourceConfig, signal?: AbortSignal) { return parseRss(await this.get(config, signal)); }
}

export class HtmlSourceAdapter extends HttpAdapter implements SourceAdapter {
  readonly type = "html" as const;
  async fetch(config: SourceConfig, signal?: AbortSignal) {
    const html = await this.get(config, signal);
    const title = decodeXml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? new URL(config.url).hostname);
    const content = decodeXml(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
    return [{ url: config.url, title, content: content.slice(0, 100_000), publishedAt: null }];
  }
}
