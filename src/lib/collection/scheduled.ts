import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventAnalyzer, SourceAdapter, SourceType } from "@/lib/collection/types";
import { collectPublicSource } from "@/lib/collection/service";

export const MAX_SOURCES_PER_RUN = 100;
export const TIME_BUDGET_MS = 240000;
export const PER_SOURCE_WORST_MS = 20000;
const HOST_INTERVAL_MS = 1100;

type SourceRow = {
  organization_id: string;
  company_id: string;
  source_url: string;
  source_type: SourceType;
  refresh_interval_minutes: number;
};
type ScheduledInput = {
  supabase: SupabaseClient;
  collect?: typeof collectPublicSource;
  createAdapter: (type: SourceType) => SourceAdapter;
  analyzer: EventAnalyzer;
  now?: () => Date;
  sleep?: (milliseconds: number) => Promise<void>;
};

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export async function runScheduledCollection(input: ScheduledInput) {
  const clock = input.now ?? (() => new Date());
  const sleep = input.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const started = clock().getTime();
  const dueAt = new Date(started).toISOString();
  const { data, error } = await input.supabase
    .from("public_sources")
    .select("organization_id,company_id,source_url,source_type,refresh_interval_minutes,next_check_at")
    .or(`next_check_at.is.null,next_check_at.lte.${dueAt}`)
    .order("next_check_at", { ascending: true, nullsFirst: true })
    .limit(MAX_SOURCES_PER_RUN);
  if (error) throw error;
  const rows = (data ?? []) as SourceRow[];
  const collect = input.collect ?? collectPublicSource;
  const hostTimes = new Map<string, number>();
  const failedRows: SourceRow[] = [];
  let succeeded = 0;
  let failed = 0;
  let documents = 0;
  let analyzedDocuments = 0;
  let extractedEvents = 0;
  let processedFirstPass = 0;
  let stoppedBy: "none" | "limit" | "time" = rows.length === MAX_SOURCES_PER_RUN ? "limit" : "none";

  const processRow = async (row: SourceRow) => {
    const host = hostOf(row.source_url);
    if (!host) throw new Error("Invalid source URL");
    const last = hostTimes.get(host);
    if (last !== undefined) {
      const wait = HOST_INTERVAL_MS - (clock().getTime() - last);
      if (wait > 0) await sleep(wait);
    }
    let rowEvents = 0;
    const analyzer: EventAnalyzer = {
      analyze: async (document) => {
        const events = await input.analyzer.analyze(document);
        rowEvents += events.length;
        return events;
      },
    };
    let result: Awaited<ReturnType<typeof collectPublicSource>>;
    try {
      result = await collect({
        supabase: input.supabase,
        organizationId: row.organization_id,
        companyId: row.company_id,
        config: { url: row.source_url, type: row.source_type, refreshIntervalMinutes: row.refresh_interval_minutes },
        adapter: input.createAdapter(row.source_type),
        analyzer,
        now: clock(),
      });
    } finally {
      hostTimes.set(host, clock().getTime());
    }
    documents += result.documents;
    analyzedDocuments += result.analyzed;
    extractedEvents += rowEvents;
  };

  for (const row of rows) {
    if (clock().getTime() - started + PER_SOURCE_WORST_MS > TIME_BUDGET_MS) {
      stoppedBy = "time";
      break;
    }
    try {
      await processRow(row);
      succeeded += 1;
    } catch {
      failedRows.push(row);
    }
    processedFirstPass += 1;
  }

  for (const row of failedRows) {
    if (clock().getTime() - started + PER_SOURCE_WORST_MS > TIME_BUDGET_MS) {
      stoppedBy = "time";
      failed += 1;
      continue;
    }
    try {
      await processRow(row);
      succeeded += 1;
    } catch {
      failed += 1;
    }
  }

  return {
    selected: rows.length,
    succeeded,
    failed,
    skipped: rows.length - processedFirstPass,
    documents,
    analyzedDocuments,
    extractedEvents,
    stoppedBy,
  };
}
