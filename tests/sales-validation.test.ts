import { describe, expect, it } from "vitest";
import { eventInputSchema, salesHistoryInputSchema, timingRuleInputSchema } from "@/lib/validation/sales";

const ids = { organizationId: "6ba7b810-9dad-41d1-80b4-00c04fd430c8", companyId: "6ba7b811-9dad-41d1-80b4-00c04fd430c8" };
describe("sales timing server validation", () => {
  it.each([{}, { offsetDays: 30 }, { leadDays: 30, offsetDays: 30 }, { leadDays: -1 }, { leadDays: 1.5 }, { leadDays: 3651 }])("rejects missing, legacy, or invalid lead time: %j", (configuration) => {
    expect(() => timingRuleInputSchema.parse({ organizationId: ids.organizationId, name: "rule", configuration: { eventType: "christmas", ...configuration } })).toThrow();
  });
  it("accepts an event with an unknown date", () => { expect(eventInputSchema.parse({ ...ids, eventType: "funding", occurredOn: null, title: "資金調達" }).occurredOn).toBeNull(); });
  it("rejects invalid dates and unknown input", () => { expect(() => salesHistoryInputSchema.parse({ ...ids, occurredOn: "2026-02-30", activityType: "approach", contactEmail: "pii@example.com" })).toThrow(); });
  it("accepts a configurable timing rule", () => { expect(timingRuleInputSchema.parse({ organizationId: ids.organizationId, name: "rule", configuration: { eventType: "funding", leadDays: 30 } }).configuration.cooldownDays).toBe(0); });
  it("rejects excessive or negative rule values", () => { expect(() => timingRuleInputSchema.parse({ organizationId: ids.organizationId, name: "rule", configuration: { eventType: "funding", leadDays: -1 } })).toThrow(); });
});
