import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { contentHash, hasContentChanged, nextCheckAt } from "@/lib/collection/freshness";
import { toAnalyzerInput } from "@/lib/collection/analyzer";
import type { EventAnalyzer, SourceAdapter, SourceConfig } from "@/lib/collection/types";

type CollectionInput = { supabase: SupabaseClient; organizationId: string; companyId: string; config: SourceConfig; adapter: SourceAdapter; analyzer: EventAnalyzer; now?: Date };

export async function collectPublicSource(input: CollectionInput) {
  const now = input.now ?? new Date();
  const checkedAt = now.toISOString();
  const nextCheck = nextCheckAt(now, input.config.refreshIntervalMinutes);
  const { data: source, error: sourceError } = await input.supabase.from("public_sources").upsert({
    organization_id: input.organizationId, company_id: input.companyId, source_url: input.config.url, source_type: input.config.type,
    refresh_interval_minutes: input.config.refreshIntervalMinutes, last_checked_at: checkedAt,
  }, { onConflict: "organization_id,company_id,source_url" }).select("id,failure_count").single();
  if (sourceError) throw sourceError;

  try {
    const documents = await input.adapter.fetch(input.config);
    let analyzed = 0;
    for (const document of documents) {
      const hash = await contentHash(document.content);
      const { data: existing, error: lookupError } = await input.supabase.from("source_documents").select("id,content_hash,fetched_at").eq("organization_id", input.organizationId).eq("company_id", input.companyId).eq("source_url", document.url).maybeSingle();
      if (lookupError) throw lookupError;
      const changed = !existing || hasContentChanged(existing.content_hash, hash);
      const values = { organization_id: input.organizationId, company_id: input.companyId, public_source_id: source.id, source_url: document.url, title: document.title, published_at: document.publishedAt, content_hash: hash, last_checked_at: checkedAt, next_check_at: nextCheck };
      const query = existing
        ? input.supabase.from("source_documents").update(values).eq("id", existing.id).select("id").single()
        : input.supabase.from("source_documents").insert({ ...values, fetched_at: checkedAt }).select("id").single();
      const { data: saved, error: documentError } = await query;
      if (documentError) throw documentError;
      if (!changed) continue;
      const events = await input.analyzer.analyze(toAnalyzerInput(document));
      for (const event of events) {
        const { error } = await input.supabase.from("events").upsert({ organization_id: input.organizationId, company_id: input.companyId, source_document_id: saved.id, event_type: event.eventType, occurred_on: event.eventDate, title: event.title, source_url: document.url, summary: event.summary, published_at: document.publishedAt, confidence: event.confidence }, { onConflict: "organization_id,company_id,event_type,occurred_on,title,source_url,source_document_id" });
        if (error) throw error;
      }
      analyzed += 1;
    }
    const { error } = await input.supabase.from("public_sources").update({ failure_count: 0, last_error: null, next_check_at: nextCheck }).eq("id", source.id);
    if (error) throw error;
    return { documents: documents.length, analyzed, nextCheckAt: nextCheck };
  } catch (error) {
    const failures = Number(source.failure_count ?? 0) + 1;
    const retryMinutes = Math.min(input.config.refreshIntervalMinutes, 5 * 2 ** Math.min(failures - 1, 8));
    await input.supabase.from("public_sources").update({ failure_count: failures, last_error: error instanceof Error ? error.message.slice(0, 500) : "Collection failed", next_check_at: nextCheckAt(now, retryMinutes) }).eq("id", source.id);
    throw error;
  }
}
