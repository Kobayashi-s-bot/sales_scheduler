export const ANALYSIS_COMPANY_FIELDS = ["id", "organization_id", "name", "website_url", "industry", "description"] as const;

export type AnalysisCompanyContext = Record<(typeof ANALYSIS_COMPANY_FIELDS)[number], string | null>;

/** Explicit allowlist: contacts and all other PII fields are structurally unavailable to analysis/AI callers. */
export function toAnalysisCompanyContext(row: Record<string, unknown>): AnalysisCompanyContext {
  return Object.fromEntries(ANALYSIS_COMPANY_FIELDS.map((field) => [field, typeof row[field] === "string" ? row[field] : null])) as AnalysisCompanyContext;
}
