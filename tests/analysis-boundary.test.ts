import { describe, expect, it } from "vitest";
import { ANALYSIS_COMPANY_FIELDS, toAnalysisCompanyContext } from "@/lib/analysis/company-context";

describe("PII/analysis boundary", () => {
  it("only returns allowlisted company fields", () => {
    const result = toAnalysisCompanyContext({ id: "company", organization_id: "org", name: "Example", website_url: null, industry: "IT", description: "Public", full_name: "Private Person", email: "private@example.com", phone: "000" });
    expect(Object.keys(result)).toEqual(ANALYSIS_COMPANY_FIELDS);
    expect(JSON.stringify(result)).not.toContain("private@example.com");
    expect(result).not.toHaveProperty("full_name");
  });
});
