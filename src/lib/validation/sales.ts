import { z } from "zod";
import { timingRuleConfigurationSchema } from "@/lib/recommendations/engine";

const organizationCompanySchema = z.object({ organizationId: z.uuid(), companyId: z.uuid() });

export const salesHistoryInputSchema = organizationCompanySchema.extend({
  occurredOn: z.iso.date(),
  activityType: z.enum(["past_project", "approach", "meeting", "proposal", "contract"]),
  outcome: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(5000).optional(),
}).strict();

export const eventInputSchema = organizationCompanySchema.extend({
  eventType: z.string().trim().min(1).max(100),
  occurredOn: z.iso.date().nullable(),
  title: z.string().trim().min(1).max(300),
  sourceUrl: z.url().max(2048).optional(),
  summary: z.string().trim().max(5000).optional(),
}).strict();

export const timingRuleInputSchema = z.object({
  organizationId: z.uuid(),
  name: z.string().trim().min(1).max(200),
  configuration: timingRuleConfigurationSchema,
  enabled: z.boolean().default(true),
}).strict();

export const recalculateInputSchema = organizationCompanySchema.strict();

export const calendarQuerySchema = z.object({ organizationId: z.uuid(), month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) }).strict();
