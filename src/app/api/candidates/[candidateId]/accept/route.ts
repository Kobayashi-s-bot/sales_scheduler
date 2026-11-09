import { requireOrganizationMembership } from "@/lib/auth/server";
import { mapCandidateRpcError, NotFoundError, safeErrorResponse } from "@/lib/http/errors";
import { recalculateCompanyRecommendations } from "@/lib/recommendations/service";
import { candidateAcceptSchema } from "@/lib/validation/candidate";
export async function POST(
  request: Request,
  context: { params: Promise<{ candidateId: string }> },
) {
  try {
    const input = candidateAcceptSchema.parse(await request.json());
    const { supabase } = await requireOrganizationMembership(input.organizationId);
    const { candidateId } = await context.params;
    const { data: candidate, error: candidateError } = await supabase
      .from("event_candidates")
      .select("company_id")
      .eq("id", candidateId)
      .eq("organization_id", input.organizationId)
      .single();

    if (candidateError || !candidate) {
      throw new NotFoundError("Candidate not found");
    }

    const { data: eventId, error } = await supabase.rpc("accept_event_candidate", {
      p_candidate_id: candidateId,
      p_event_type: input.eventType ?? null,
      p_occurred_on: input.occurredOn ?? null,
      p_title: input.title ?? null,
    });
    if (error) throw mapCandidateRpcError(error.message);

    const recommendations = await recalculateCompanyRecommendations(
      supabase,
      input.organizationId,
      candidate.company_id,
    );
    return Response.json({ data: { eventId }, recommendations });
  } catch (error) {
    return safeErrorResponse(error);
  }
}
