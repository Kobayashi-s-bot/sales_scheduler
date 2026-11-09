import { requireOrganizationMembership } from "@/lib/auth/server";
import { safeErrorResponse } from "@/lib/http/errors";
import { candidateListSchema } from "@/lib/validation/candidate";
export async function GET(request: Request) {
  try {
    const queryParams = new URL(request.url).searchParams;
    const input = candidateListSchema.parse({
      organizationId: queryParams.get("organizationId"),
      ...(queryParams.has("status") ? { status: queryParams.get("status") } : {}),
      ...(queryParams.has("companyId") ? { companyId: queryParams.get("companyId") } : {}),
    });
    const { supabase } = await requireOrganizationMembership(input.organizationId);
    let query = supabase
      .from("event_candidates")
      .select("*")
      .eq("organization_id", input.organizationId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (input.status) query = query.eq("status", input.status);
    if (input.companyId) query = query.eq("company_id", input.companyId);

    const { data, error } = await query;
    if (error) throw error;
    return Response.json({ data });
  } catch (error) {
    return safeErrorResponse(error);
  }
}
