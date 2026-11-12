import { z } from "zod";
import { assertPublicHttpsUrl } from "@/lib/collection/policy";

export const publicSourceInputSchema = z.object({
  companyId: z.uuid(),
  sourceUrl: z.string().trim().min(1).max(2048).refine((value) => {
    try {
      assertPublicHttpsUrl(value);
      return true;
    } catch {
      return false;
    }
  }, "Public HTTPS URL required"),
  sourceType: z.enum(["rss", "html"]),
}).strict();
