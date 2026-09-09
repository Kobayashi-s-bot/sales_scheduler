import { describe, expect, it } from "vitest";
import { scheduleRanges, todayInTokyo } from "@/lib/dates";
describe("sales schedule ranges", () => {
  it("uses the Tokyo business date around UTC midnight", () => { expect(todayInTokyo(new Date("2027-01-01T16:00:00Z"))).toBe("2027-01-02"); });
  it("builds today, week and month boundaries", () => { expect(scheduleRanges("2027-08-27")).toEqual({ today: "2027-08-27", weekEnd: "2027-08-29", monthEnd: "2027-08-31" }); });
  it("treats Sunday as the end of the current week", () => { expect(scheduleRanges("2027-08-29").weekEnd).toBe("2027-08-29"); });
});
