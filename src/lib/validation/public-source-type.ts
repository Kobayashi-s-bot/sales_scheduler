// Browser-safe helper. Keep this file free of Node-only imports (e.g. collection/policy → node:dns),
// because the client component public-sources-panel.tsx imports it.
export function suggestSourceType(url: string): "rss" | "html" {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return /\.(xml|rss|atom)$/.test(path) || /\/(feed|rss)(\/|$)/.test(path) ? "rss" : "html";
  } catch {
    return "html";
  }
}
