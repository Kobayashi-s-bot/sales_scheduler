import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MonthlyCalendar } from "@/components/monthly-calendar";
describe("early access UI", () => {
  it("links a calendar recommendation to the organization-scoped company detail", () => { const html = renderToStaticMarkup(<MonthlyCalendar month="2027-08" organizationId="org-1" items={[{ id: "r", recommended_on: "2027-08-27", reason: "120日前", companies: { id: "company-1", name: "Example社" } }]} />); expect(html).toContain("/companies/company-1?organizationId=org-1"); expect(html).toContain("120日前"); });
});
