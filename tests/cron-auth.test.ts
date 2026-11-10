import { describe, expect, it } from "vitest";
import { verifyCronAuthorization } from "@/lib/collection/cron-auth";

const secret = "local-test-value-long-enough-to-be-valid";

describe("verifyCronAuthorization", () => {
  it.each([
    [null, secret],
    ["Basic value", secret],
    [`Bearer ${secret}x`, secret],
    [`Bearer ${secret}`, undefined],
    [`Bearer ${secret}`, "short"],
  ])("rejects invalid authorization settings", (header, configured) => {
    expect(verifyCronAuthorization(header, configured)).toBe(false);
  });

  it("accepts an exact bearer secret", () => {
    expect(verifyCronAuthorization(`Bearer ${secret}`, secret)).toBe(true);
  });
});
