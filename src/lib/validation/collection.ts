import { z } from "zod";
import { assertPublicHttpsUrl } from "@/lib/collection/policy";

export const collectSourceInputSchema = z.object({
  organizationId: z.uuid(), companyId: z.uuid(), sourceUrl: z.url().max(2048).refine((value) => { try { assertPublicHttpsUrl(value); return true; } catch { return false; } }, "Public HTTPS URL required"), sourceType: z.enum(["rss", "html"]),
  refreshIntervalMinutes: z.number().int().min(5).max(43_200).default(1_440),
}).strict();
