export type CandidateStatus = "pending" | "accepted" | "rejected";
export function parseCandidateStatus(value: unknown): CandidateStatus { return value === "accepted" || value === "rejected" || value === "pending" ? value : "pending"; }
export function formatConfidence(value: unknown): string { const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN; return Number.isFinite(number) && number >= 0 && number <= 1 ? `${Math.round(number * 100)}%` : "—"; }
export function formatEventDate(value: string | null): string { return value ?? "日付未定"; }
export function formatTokyoDate(value: string | null): string { if (!value) return "不明"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "不明" : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date); }
export function safeExternalUrl(value: string | null): string | null { if (!value) return null; try { const url = new URL(value); return url.protocol === "https:" ? url.href : null; } catch { return null; } }
export type AcceptBase = { organizationId: string; eventType: string; occurredOn: string | null; title: string };
export type AcceptInput = { eventType: string; occurredOn: string; title: string };
export function validateAndBuildAcceptPayload(base: AcceptBase, input: AcceptInput): { ok: true; payload: Record<string, string> } | { ok: false; field: "eventType" | "occurredOn" | "title" } {
  const eventType = input.eventType.trim(); const title = input.title.trim(); const date = input.occurredOn;
  if (eventType.length < 1 || eventType.length > 100) return { ok: false, field: "eventType" };
  if (title.length < 1 || title.length > 300) return { ok: false, field: "title" };
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date)) return { ok: false, field: "occurredOn" };
  if (!date && base.occurredOn === null) return { ok: false, field: "occurredOn" };
  const payload: Record<string, string> = { organizationId: base.organizationId };
  if (eventType !== base.eventType) payload.eventType = eventType;
  if (date !== (base.occurredOn ?? "")) { if (date) payload.occurredOn = date; }
  if (title !== base.title) payload.title = title;
  return { ok: true, payload };
}
export function candidateErrorMessage(status: number): string { if (status === 400) return "入力内容を確認してください。"; if (status === 404) return "この候補は見つかりませんでした。一覧を更新してください。"; if (status === 409) return "この候補はすでに処理済みです。一覧を更新してください。"; if (status === 401) return "ログインし直してください。"; if (status === 403) return "この組織の候補を操作する権限がありません。"; return "処理できませんでした。時間をおいて再試行してください。"; }
