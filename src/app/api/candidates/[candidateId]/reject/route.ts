import { requireOrganizationMembership } from "@/lib/auth/server";
import { ConflictError, NotFoundError, safeErrorResponse } from "@/lib/http/errors";
import { candidateRejectSchema } from "@/lib/validation/candidate";
export async function POST(
  request: Request,
  context: { params: Promise<{ candidateId: string }> },
) {
  try {
    const input = candidateRejectSchema.parse(await request.json());
    const { supabase, user } = await requireOrganizationMembership(input.organizationId);
    const { candidateId } = await context.params;
    const { data: candidate, error: lookupError } = await supabase
      .from("event_candidates")
      .select("status")
      .eq("id", candidateId)
      .eq("organization_id", input.organizationId)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (!candidate) throw new NotFoundError("Candidate not found");
    if (candidate.status !== "pending") {
      throw new ConflictError("Candidate is not pending");
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("event_candidates")
      .update({ status: "rejected", reviewed_by: user.id, reviewed_at: now, updated_at: now })
      .eq("id", candidateId)
      .eq("organization_id", input.organizationId)
      .eq("status", "pending")
      .select("id,status")
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new ConflictError("Candidate is not pending");
    return Response.json({ data });
  } catch (error) {
    return safeErrorResponse(error);
  }
}
