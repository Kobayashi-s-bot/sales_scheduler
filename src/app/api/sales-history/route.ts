import { requireOrganizationMembership } from "@/lib/auth/server";
import { safeErrorResponse } from "@/lib/http/errors";
import { recalculateCompanyRecommendations } from "@/lib/recommendations/service";
import { salesHistoryInputSchema } from "@/lib/validation/sales";

export async function POST(request: Request) {
  try {
    const input = salesHistoryInputSchema.parse(await request.json());
    const { supabase } = await requireOrganizationMembership(input.organizationId);
    const { data, error } = await supabase.from("sales_history").insert({ organization_id: input.organizationId, company_id: input.companyId, occurred_on: input.occurredOn, activity_type: input.activityType, outcome: input.outcome ?? null, notes: input.notes ?? null }).select("id,occurred_on,activity_type,outcome,notes").single();
    if (error) throw error;
    await recalculateCompanyRecommendations(supabase, input.organizationId, input.companyId);
    return Response.json({ data }, { status: 201 });
  } catch (error) { return safeErrorResponse(error); }
}
