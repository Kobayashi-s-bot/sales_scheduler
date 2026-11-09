import { describe, expect, it } from "vitest";
import { contactInputSchema, contactUpdateSchema } from "@/lib/validation/contact";
const ids = { organizationId: "6ba7b810-9dad-41d1-80b4-00c04fd430c8", companyId: "6ba7b811-9dad-41d1-80b4-00c04fd430c8" };
describe("contact validation", () => {
  it("accepts contact fields and blank optional values", () => { expect(contactInputSchema.parse({ ...ids, fullName: "担当者", email: "" }).email).toBe(""); });
  it("rejects invalid email and unknown fields", () => { expect(() => contactInputSchema.parse({ ...ids, email: "invalid", analysisPrompt: "PII" })).toThrow(); });
  it("requires a UUID when editing", () => { expect(() => contactUpdateSchema.parse({ ...ids, contactId: "bad" })).toThrow(); });
});
