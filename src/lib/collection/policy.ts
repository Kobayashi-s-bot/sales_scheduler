import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const BLOCKED_HOSTS = new Set(["localhost", "localhost.localdomain"]);
const PRIVATE_HOST_ERROR = "Private hosts are not allowed";

function ipv4Number(address: string) {
  const parts = address.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return null;
  return parts.reduce((value, part) => value * 256 + Number(part), 0);
}

function isPrivateIpv4(address: string) {
  const ip = ipv4Number(address);
  if (ip === null) return true;
  const ranges: Array<[number, number]> = [
    ["0.0.0.0", "0.255.255.255"], ["10.0.0.0", "10.255.255.255"], ["100.64.0.0", "100.127.255.255"],
    ["127.0.0.0", "127.255.255.255"], ["169.254.0.0", "169.254.255.255"], ["172.16.0.0", "172.31.255.255"],
    ["192.168.0.0", "192.168.255.255"], ["192.0.0.0", "192.0.0.255"], ["198.18.0.0", "198.19.255.255"],
    ["224.0.0.0", "255.255.255.255"],
  ].map(([start, end]) => [ipv4Number(start)!, ipv4Number(end)!] as [number, number]);
  return ranges.some(([start, end]) => ip >= start && ip <= end);
}

function ipv6Words(address: string): number[] | null {
  let input = address.toLowerCase();
  if (input.includes(".")) {
    const cut = input.lastIndexOf(":");
    const v4 = ipv4Number(input.slice(cut + 1));
    if (v4 === null) return null;
    input = `${input.slice(0, cut)}:${((v4 >>> 16) & 0xffff).toString(16)}:${(v4 & 0xffff).toString(16)}`;
  }
  if ((input.match(/::/g) ?? []).length > 1) return null;
  const halves = input.split("::");
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length > 1 && halves[1] ? halves[1].split(":") : [];
  const words = [...left, ...Array(halves.length > 1 ? 8 - left.length - right.length : 0).fill("0"), ...right];
  if (words.length !== 8 || words.some((word) => !/^[0-9a-f]{1,4}$/.test(word))) return null;
  return words.map((word) => parseInt(word, 16));
}

function isPrivateAddress(address: string) {
  const family = isIP(address);
  if (family === 4) return isPrivateIpv4(address);
  if (family !== 6) return true;
  const words = ipv6Words(address);
  if (!words) return true;
  const embedded = words.slice(0, 5).every((word) => word === 0) && (words[5] === 0 || words[5] === 0xffff);
  if (embedded) return isPrivateIpv4(`${words[6] >> 8}.${words[6] & 255}.${words[7] >> 8}.${words[7] & 255}`);
  return words.every((word) => word === 0) || (words.slice(0, 7).every((word) => word === 0) && words[7] === 1) ||
    (words[0] & 0xfe00) === 0xfc00 || (words[0] & 0xffc0) === 0xfe80 || (words[0] & 0xff00) === 0xff00;
}

export function assertPublicHttpsUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("Only public HTTPS sources are allowed");
  if (url.username || url.password || (url.port && url.port !== "443")) throw new Error("Source URL credentials and non-standard ports are not allowed");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".local") || (isIP(host) !== 0 && isPrivateAddress(host))) throw new Error(PRIVATE_HOST_ERROR);
  return url;
}

type Resolver = (hostname: string) => Promise<Array<{ address: string; family: number }>>;
export async function assertPublicHostResolves(value: string, resolver: Resolver = async (hostname) => lookup(hostname, { all: true })) {
  const url = assertPublicHttpsUrl(value);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return;
  let addresses: Array<{ address: string; family: number }>;
  try { addresses = await resolver(host); } catch { throw new Error("Source host DNS resolution failed"); }
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) throw new Error(PRIVATE_HOST_ERROR);
}

export function robotsUrl(sourceUrl: string) {
  const url = assertPublicHttpsUrl(sourceUrl);
  return new URL("/robots.txt", url).toString();
}

export function isPathAllowedByRobots(robotsText: string, sourceUrl: string, userAgent = "SalesSchedulerBot") {
  const url = new URL(sourceUrl);
  const path = `${url.pathname}${url.search}`;
  type Group = { agents: string[]; rules: Array<{ allow: boolean; pattern: string }> };
  const groups: Group[] = [];
  let current: Group | null = null;
  let hasRules = false;
  for (const rawLine of robotsText.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === "user-agent") {
      if (!current || hasRules) { current = { agents: [], rules: [] }; groups.push(current); hasRules = false; }
      current.agents.push(value.toLowerCase());
    } else if ((key === "allow" || key === "disallow") && current) {
      hasRules = true;
      if (value) current.rules.push({ allow: key === "allow", pattern: value });
    }
  }
  const ua = userAgent.toLowerCase();
  const specific = groups.filter((group) => group.agents.some((agent) => agent !== "*" && ua.includes(agent)));
  const selected = specific.length ? specific : groups.filter((group) => group.agents.includes("*"));
  const rules = selected.flatMap((group) => group.rules).map((rule) => {
    const anchored = rule.pattern.endsWith("$");
    const body = anchored ? rule.pattern.slice(0, -1) : rule.pattern;
    const escaped = body.split("*").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*");
    return { ...rule, specificity: [...body].filter((char) => char !== "*").length, regex: new RegExp(`^${escaped}${anchored ? "$" : ""}`) };
  }).filter((rule) => rule.regex.test(path)).sort((a, b) => b.specificity - a.specificity || Number(b.allow) - Number(a.allow));
  return rules.length === 0 || rules[0].allow;
}
