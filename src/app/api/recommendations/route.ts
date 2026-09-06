import { requireOrganizationMembership } from "@/lib/auth/server";
import { safeErrorResponse } from "@/lib/http/errors";
import { calendarQuerySchema } from "@/lib/validation/sales";

function nextMonth(month: string) {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, value, 1));
  return date.toISOString().slice(0, 7);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const input = calendarQuerySchema.parse({ organizationId: url.searchParams.get("organizationId"), month: url.searchParams.get("month") });
    const { supabase } = await requireOrganizationMembership(input.organizationId);
    const { data, error } = await supabase.from("sales_recommendations").select("id,recommended_on,reason,status,evidence,companies(id,name)").eq("organization_id", input.organizationId).gte("recommended_on", `${input.month}-01`).lt("recommended_on", `${nextMonth(input.month)}-01`).eq("status", "pending").order("recommended_on");
    if (error) throw error;
    return Response.json({ data });
  } catch (error) { return safeErrorResponse(error); }
}
