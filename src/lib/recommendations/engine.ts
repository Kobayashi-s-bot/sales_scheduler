import { z } from "zod";

export const timingRuleConfigurationSchema = z.object({
  eventType: z.string().trim().min(1).max(100),
  leadDays: z.number().int().min(0).max(3650),
  cooldownDays: z.number().int().min(0).max(3650).default(0),
}).strict();

export type TimingRule = {
  id: string;
  name: string;
  enabled: boolean;
  configuration: z.input<typeof timingRuleConfigurationSchema>;
};
export type TimingEvent = { id: string; eventType: string; occurredOn: string | null; title: string; sourceUrl: string | null };
export type SalesActivity = { id: string; occurredOn: string; activityType: string };
export type RecommendationDraft = {
  sourceEventId: string;
  scoringRuleId: string;
  recommendedOn: string;
  reason: string;
  evidence: { eventId: string; eventType: string; eventDate: string; sourceUrl: string | null; ruleId: string; leadDays: number; latestActivityId: string | null; cooldownDays: number };
};

function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid date: ${value}`);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (date.toISOString().slice(0, 10) !== value) throw new Error(`Invalid date: ${value}`);
  return date;
}

export function addCalendarDays(value: string, days: number) {
  const date = parseDateOnly(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function calculateRecommendations(events: TimingEvent[], rules: TimingRule[], activities: SalesActivity[]): RecommendationDraft[] {
  const uniqueEvents = [...new Map(events.map((event) => [event.id, event])).values()];
  const latestActivity = [...activities].sort((a, b) => b.occurredOn.localeCompare(a.occurredOn))[0] ?? null;
  const drafts: RecommendationDraft[] = [];

  for (const event of uniqueEvents) {
    if (!event.occurredOn) continue;
    for (const rule of rules) {
      if (!rule.enabled) continue;
      const configuration = timingRuleConfigurationSchema.parse(rule.configuration);
      if (configuration.eventType !== event.eventType) continue;
      const eventCandidate = addCalendarDays(event.occurredOn, -configuration.leadDays);
      const activityCandidate = latestActivity ? addCalendarDays(latestActivity.occurredOn, configuration.cooldownDays) : null;
      const recommendedOn = activityCandidate && activityCandidate > eventCandidate ? activityCandidate : eventCandidate;
      const activityExplanation = activityCandidate && activityCandidate > eventCandidate
        ? `。直近の営業活動（${latestActivity?.occurredOn}）から${configuration.cooldownDays}日間隔を確保`
        : "";
      drafts.push({
        sourceEventId: event.id,
        scoringRuleId: rule.id,
        recommendedOn,
        reason: `「${event.title}」（${event.occurredOn}）を起点に、ルール「${rule.name}」の${configuration.leadDays}日前を適用${activityExplanation}`,
        evidence: { eventId: event.id, eventType: event.eventType, eventDate: event.occurredOn, sourceUrl: event.sourceUrl, ruleId: rule.id, leadDays: configuration.leadDays, latestActivityId: latestActivity?.id ?? null, cooldownDays: configuration.cooldownDays },
      });
    }
  }
  return drafts.sort((a, b) => a.recommendedOn.localeCompare(b.recommendedOn) || a.sourceEventId.localeCompare(b.sourceEventId));
}
