import { requireOrganizationMembership } from "@/lib/auth/server";
import { safeErrorResponse } from "@/lib/http/errors";
import { recalculateCompanyRecommendations } from "@/lib/recommendations/service";
import { recalculateInputSchema } from "@/lib/validation/sales";

export async function POST(request: Request) {
  try {
    const input = recalculateInputSchema.parse(await request.json());
    const { supabase } = await requireOrganizationMembership(input.organizationId);
    return Response.json({ data: await recalculateCompanyRecommendations(supabase, input.organizationId, input.companyId) });
  } catch (error) { return safeErrorResponse(error); }
}
