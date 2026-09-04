import { describe, expect, it } from "vitest";
import { companyInputSchema } from "@/lib/validation/company";

const validInput = { organizationId: "6ba7b810-9dad-41d1-80b4-00c04fd430c8", name: "Example Inc." };
describe("company input validation", () => {
  it("accepts a valid input", () => { expect(companyInputSchema.parse(validInput)).toEqual(validInput); });
  it("rejects malformed organization IDs", () => { expect(() => companyInputSchema.parse({ ...validInput, organizationId: "org-a" })).toThrow(); });
  it("rejects unknown fields and invalid URLs", () => { expect(() => companyInputSchema.parse({ ...validInput, websiteUrl: "not a URL", unexpected: true })).toThrow(); });
});
