export async function contentHash(content: string) {
  const bytes = new TextEncoder().encode(content.replace(/\r\n/g, "\n").trim());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function nextCheckAt(checkedAt: Date, refreshIntervalMinutes: number) {
  if (!Number.isInteger(refreshIntervalMinutes) || refreshIntervalMinutes < 5 || refreshIntervalMinutes > 43_200) throw new Error("Invalid refresh interval");
  return new Date(checkedAt.getTime() + refreshIntervalMinutes * 60_000).toISOString();
}

export function isDue(nextCheck: string | null, now = new Date()) {
  return nextCheck === null || Date.parse(nextCheck) <= now.getTime();
}

export function hasContentChanged(previousHash: string | null, currentHash: string) {
  return previousHash !== null && previousHash !== currentHash;
}
