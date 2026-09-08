const BLOCKED_HOSTS = new Set(["localhost", "localhost.localdomain"]);

export function assertPublicHttpsUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("Only public HTTPS sources are allowed");
  if (url.username || url.password || (url.port && url.port !== "443")) throw new Error("Source URL credentials and non-standard ports are not allowed");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".local") || host === "::1" || host === "0.0.0.0") throw new Error("Private hosts are not allowed");
  if (/^(0\.|10\.|127\.|169\.254\.|192\.168\.|224\.|240\.|255\.)/.test(host)) throw new Error("Private hosts are not allowed");
  const carrier = host.match(/^100\.(\d{1,3})\./);
  if (carrier && Number(carrier[1]) >= 64 && Number(carrier[1]) <= 127) throw new Error("Private hosts are not allowed");
  const match = host.match(/^172\.(\d{1,3})\./);
  if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31) throw new Error("Private hosts are not allowed");
  return url;
}

export function robotsUrl(sourceUrl: string) {
  const url = assertPublicHttpsUrl(sourceUrl);
  return new URL("/robots.txt", url).toString();
}

export function isPathAllowedByRobots(robotsText: string, sourceUrl: string, userAgent = "SalesSchedulerBot") {
  const path = new URL(sourceUrl).pathname;
  let applies = false;
  for (const rawLine of robotsText.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === "user-agent") applies = value === "*" || value.toLowerCase() === userAgent.toLowerCase();
    if (applies && key === "disallow" && value && path.startsWith(value)) return false;
  }
  return true;
}
