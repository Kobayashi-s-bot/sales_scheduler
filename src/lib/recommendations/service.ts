import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateRecommendations } from "@/lib/recommendations/engine";

export async function recalculateCompanyRecommendations(supabase: SupabaseClient, organizationId: string, companyId: string) {
  const [eventsResult, rulesResult, historyResult] = await Promise.all([
    supabase.from("events").select("id,event_type,occurred_on,title,source_url").eq("organization_id", organizationId).eq("company_id", companyId),
    supabase.from("scoring_rules").select("id,name,enabled,configuration").eq("organization_id", organizationId).eq("rule_type", "event_timing"),
    supabase.from("sales_history").select("id,occurred_on,activity_type").eq("organization_id", organizationId).eq("company_id", companyId),
  ]);
  const error = eventsResult.error ?? rulesResult.error ?? historyResult.error;
  if (error) throw error;

  const drafts = calculateRecommendations(
    (eventsResult.data ?? []).map((row) => ({ id: row.id, eventType: row.event_type, occurredOn: row.occurred_on, title: row.title, sourceUrl: row.source_url })),
    (rulesResult.data ?? []).map((row) => ({ id: row.id, name: row.name, enabled: row.enabled, configuration: row.configuration })),
    (historyResult.data ?? []).map((row) => ({ id: row.id, occurredOn: row.occurred_on, activityType: row.activity_type })),
  );
  const { error: deleteError } = await supabase.from("sales_recommendations").delete().eq("organization_id", organizationId).eq("company_id", companyId).eq("status", "pending");
  if (deleteError) throw deleteError;
  if (drafts.length) {
    const { error: upsertError } = await supabase.from("sales_recommendations").upsert(drafts.map((draft) => ({ organization_id: organizationId, company_id: companyId, source_event_id: draft.sourceEventId, scoring_rule_id: draft.scoringRuleId, recommended_on: draft.recommendedOn, reason: draft.reason, evidence: draft.evidence, status: "pending" })), { onConflict: "organization_id,company_id,source_event_id,scoring_rule_id" });
    if (upsertError) throw upsertError;
  }
  return drafts;
}
